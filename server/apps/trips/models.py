import uuid

from django.db import models


class Trip(models.Model):
    """이동 기록 (C-01 시작 / C-06 완료). 게스트는 device_id로 식별."""
    STATUS = [("in_progress", "이동중"), ("completed", "완료"), ("cancelled", "취소")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_id = models.CharField(max_length=64, db_index=True)
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
