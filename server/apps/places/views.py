"""places 앱 뷰. 지금은 GET /api/shelters (C-04 실내 대기 장소)만 구현."""
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.common.response import error_response
from .services import kakao_local, shade_store


class PlaceSearchView(APIView):
    """GET /api/places/search?q=&lat=&lng=  → 키워드 장소 검색(B-02)."""

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"places": []})
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        try:
            coords = (float(lat), float(lng)) if lat and lng else (None, None)
        except ValueError:
            coords = (None, None)
        try:
            places = kakao_local.search_places(q, coords[0], coords[1])
        except Exception:
            return error_response("UPSTREAM_TIMEOUT", "장소 검색에 실패했어요.", 504)
        return Response({"places": places})


class SheltersView(APIView):
    """GET /api/shelters?lat=&lng=&radius=  → 근처 실내 대기 장소(도보 가까운 순)."""

    def get(self, request):
        q = request.query_params
        try:
            lat, lng = float(q["lat"]), float(q["lng"])
        except (KeyError, ValueError):
            return error_response("VALIDATION_ERROR", "위치(lat, lng)가 필요해요.", 400)
        try:
            radius = min(1000, max(50, int(q.get("radius", 400))))
        except ValueError:
            radius = 400

        try:
            shelters = kakao_local.search_shelters(lat, lng, radius)
        except Exception:
            return error_response("UPSTREAM_TIMEOUT", "주변 장소를 불러오지 못했어요.", 504)

        return Response({"shelters": shelters})


class ShadesView(APIView):
    """GET /api/shades?lat=&lng=&radius=  → 근처 야외 그늘막(도보 가까운 순). 로컬 저장분에서 조회."""

    def get(self, request):
        q = request.query_params
        try:
            lat, lng = float(q["lat"]), float(q["lng"])
        except (KeyError, ValueError):
            return error_response("VALIDATION_ERROR", "위치(lat, lng)가 필요해요.", 400)
        try:
            radius = min(2000, max(50, int(q.get("radius", 500))))
        except ValueError:
            radius = 500

        try:
            shades = shade_store.nearby(lat, lng, radius)
        except Exception:
            return error_response("UPSTREAM_TIMEOUT", "그늘막 정보를 불러오지 못했어요.", 504)

        return Response({"shades": shades})
