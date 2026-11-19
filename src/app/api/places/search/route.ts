import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verificar sesión de Supabase
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

    // 2. Leer la API key de Places
    const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!placesApiKey) {
      return NextResponse.json(
        {
          error:
            "Falta configurar GOOGLE_PLACES_API_KEY en .env.local. Agrega tu clave de Google Cloud con Places API (New) habilitada.",
        },
        { status: 400 }
      );
    }

    // 3. Extraer parámetros del body
    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const latitude = typeof body.latitude === "number" ? body.latitude : null;
    const longitude = typeof body.longitude === "number" ? body.longitude : null;
    const radiusMeters =
      typeof body.radiusMeters === "number" && body.radiusMeters > 0
        ? body.radiusMeters
        : 2000;

    if (!query && (latitude === null || longitude === null)) {
      return NextResponse.json(
        {
          error:
            "Debes ingresar un término de búsqueda (ej: 'clínicas', 'restaurantes') o activar tu ubicación actual.",
        },
        { status: 400 }
      );
    }

    // 4. Determinar endpoint y payload de Google Places API (New)
    let url = "https://places.googleapis.com/v1/places:searchText";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let requestPayload: Record<string, any> = {};

    if (query) {
      url = "https://places.googleapis.com/v1/places:searchText";
      requestPayload = {
        textQuery: query,
        maxResultCount: 15,
        languageCode: "es",
      };

      if (latitude !== null && longitude !== null) {
        requestPayload.locationBias = {
          circle: {
            center: {
              latitude,
              longitude,
            },
            radius: radiusMeters,
          },
        };
      }
    } else {
      url = "https://places.googleapis.com/v1/places:searchNearby";
      requestPayload = {
        maxResultCount: 15,
        languageCode: "es",
        locationRestriction: {
          circle: {
            center: {
              latitude: latitude!,
              longitude: longitude!,
            },
            radius: radiusMeters,
          },
        },
      };
    }

    // 5. Llamar a Places API (New) con X-Goog-FieldMask
    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.nationalPhoneNumber",
      "places.websiteUri",
      "places.googleMapsUri",
      "places.rating",
      "places.userRatingCount",
      "places.primaryTypeDisplayName",
    ].join(",");

    const googleRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": placesApiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(requestPayload),
    });

    const googleData = await googleRes.json();

    if (!googleRes.ok) {
      const errMsg =
        googleData?.error?.message ||
        `Error al consultar Google Places API (${googleRes.status})`;
      return NextResponse.json({ error: errMsg }, { status: googleRes.status });
    }

    const rawPlaces = Array.isArray(googleData.places) ? googleData.places : [];

    // 6. Normalizar y marcar oportunidades altas (sin websiteUri)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanResults = rawPlaces.slice(0, 15).map((p: any) => {
      const displayName =
        typeof p.displayName === "object" && p.displayName?.text
          ? p.displayName.text
          : typeof p.displayName === "string"
          ? p.displayName
          : "Sin nombre";

      const primaryType =
        typeof p.primaryTypeDisplayName === "object" &&
        p.primaryTypeDisplayName?.text
          ? p.primaryTypeDisplayName.text
          : typeof p.primaryTypeDisplayName === "string"
          ? p.primaryTypeDisplayName
          : query || "Comercio local";

      const websiteUrl = p.websiteUri || null;
      const hasNoWebsite = !websiteUrl; // Oportunidad alta para servicios digitales

      return {
        id: p.id || Math.random().toString(36).substring(2),
        business_name: displayName,
        niche: primaryType,
        zone: p.formattedAddress || null,
        phone: p.nationalPhoneNumber || null,
        website_url: websiteUrl,
        maps_url: p.googleMapsUri || null,
        has_no_website: hasNoWebsite,
        rating: typeof p.rating === "number" ? p.rating : null,
        user_rating_count:
          typeof p.userRatingCount === "number" ? p.userRatingCount : 0,
      };
    });

    return NextResponse.json({
      places: cleanResults,
      count: cleanResults.length,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error inesperado al buscar en Google Places";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
