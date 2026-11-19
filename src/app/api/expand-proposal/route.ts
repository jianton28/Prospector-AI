import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExpandProposalPrompt } from "@/prompts/proposalPrompt";
import { generateTextResponse } from "@/lib/ai/provider";
import { ConsultantProfile, Prospect, Proposal } from "@/types/prospector";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verificar sesión autenticada
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión primero." },
        { status: 401 }
      );
    }

    // 2. Validar parámetros de entrada
    const body = await req.json();
    const prospectId = body?.prospectId as string | undefined;
    const meetingNotes = body?.meetingNotes as string | undefined;
    const estimatedRange = body?.estimatedRange as string | undefined;

    if (!prospectId || !meetingNotes || !meetingNotes.trim()) {
      return NextResponse.json(
        { error: "Se requieren prospectId y meetingNotes para expandir la propuesta." },
        { status: 400 }
      );
    }

    // 3. Obtener prospecto (RLS valida propiedad)
    const { data: prospect, error: prospectError } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", prospectId)
      .single();

    if (prospectError || !prospect) {
      return NextResponse.json(
        { error: "Prospecto no encontrado o sin acceso." },
        { status: 404 }
      );
    }

    // 4. Obtener propuesta actual (o crear estructura mínima si aún no existía)
    const { data: existingProposal } = await supabase
      .from("proposals")
      .select("*")
      .eq("prospect_id", prospectId)
      .maybeSingle();

    const baseProposal: Proposal = (existingProposal as Proposal | null) ?? {
      id: "",
      prospect_id: prospectId,
      user_id: user.id,
      initial_draft: null,
      meeting_notes: null,
      expanded_proposal: null,
      estimated_range: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 5. Obtener perfil del consultor
    const { data: profile } = await supabase
      .from("consultant_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // 6. Construir prompt y generar propuesta ampliada con Gemini
    const prompt = buildExpandProposalPrompt({
      prospect: prospect as Prospect,
      profile: (profile as ConsultantProfile | null) ?? null,
      proposal: baseProposal,
      meetingNotes: meetingNotes.trim(),
      estimatedRange: estimatedRange?.trim() || baseProposal.estimated_range || undefined,
    });

    const expandedProposal = await generateTextResponse(prompt);

    // 7. Guardar notas y propuesta ampliada en 'proposals'
    const finalRange =
      estimatedRange?.trim() || baseProposal.estimated_range || null;

    const { data: savedProposal, error: saveError } = await supabase
      .from("proposals")
      .upsert(
        {
          prospect_id: prospectId,
          user_id: user.id,
          initial_draft: baseProposal.initial_draft,
          meeting_notes: meetingNotes.trim(),
          expanded_proposal: expandedProposal,
          estimated_range: finalRange,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "prospect_id" }
      )
      .select()
      .single();

    if (saveError) {
      return NextResponse.json(
        { error: `Error al guardar la propuesta ampliada: ${saveError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ proposal: savedProposal });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error interno al expandir la propuesta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}