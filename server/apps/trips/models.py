import uuid

from django.db import models


class Trip(models.Model):
    """이동 기록 (C-01 시작 / C-06 완료). 게스트는 device_id로 식별."""
    STATUS = [("in_progress", "이동중"), ("completed", "완료"), ("cancelled", "취소")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_id = models.CharField(max_length=64, blank=True, default="", db_index=True)  # 게스트 식별
    account = models.ForeignKey("accounts.Account", null=True, blank=True, on_delete=models.CASCADE, related_name="trips")  # 로그인 시 소유
    status = models.CharField(max_length=12, choices=STATUS, default="in_progress")

    from_name = models.CharField(max_length=120, blank=True, default="")
    to_name = models.CharField(max_length=120, blank=True, default="")

    # 선택한 경로 요약 (노출 부하 누적의 원천)
    total_minutes = models.IntegerField(default=0)
    exposure_load = models.IntegerField(default=0)
    outdoor_minutes = models.IntegerField(default=0)
    uv_minutes = models.IntegerField(default=0)

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]


class ArrivalSnapshot(models.Model):
    """E-04 크롤러가 대표 정류소 도착정보를 주기 수집·저장. live TAGO 실패 시 폴백 소스."""
    city_code = models.CharField(max_length=8)
    node_id = models.CharField(max_length=32, db_index=True)
    route_no = models.CharField(max_length=16)
    route_id = models.CharField(max_length=32, blank=True, default="")
    minutes = models.IntegerField()
    stations_left = models.IntegerField(null=True, blank=True)
    collected_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-collected_at"]
