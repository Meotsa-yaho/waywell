"""trips 앱 뷰. 지금은 GET /api/arrival (C-02 실시간 도착 조회)만 구현."""
from datetime import datetime, timezone, timedelta

from rest_framework.views import APIView
from rest_framework.response import Response

from apps.common.response import error_response
from .services import tago_client

KST = timezone(timedelta(hours=9))

# TAGO cityCode 미지정 시 기본값. 데모 정류소(세종)용. 실서비스는 정류소→cityCode 매핑 필요.
DEFAULT_CITY_CODE = "25"


class ArrivalView(APIView):
    """GET /api/arrival?station_id=&route_id=&city_code=  → 다음 버스 도착 예정."""

    def get(self, request):
        q = request.query_params
        station_id = q.get("station_id")
        if not station_id:
            return error_response("VALIDATION_ERROR", "정류소 ID(station_id)가 필요해요.", 400)
        route_id = q.get("route_id")
        city_code = q.get("city_code", DEFAULT_CITY_CODE)

        try:
            arrivals = tago_client.get_arrivals(city_code, station_id, route_id)
        except Exception:
            return error_response("UPSTREAM_TIMEOUT", "도착 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.", 504)

        notice = None if arrivals else "곧 도착 예정인 차량이 없어요."
        return Response({
            "station_id": station_id,
            "route_id": route_id,
            "route_name": arrivals[0]["route_name"] if arrivals else None,
            "arrivals": arrivals,
            "prediction_grade": "realtime",
            "data_source": "tago",
            "notice": notice,
            "polled_at": datetime.now(KST).replace(microsecond=0).isoformat(),
        })
