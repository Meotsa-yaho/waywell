"""E-04 도착정보 크롤러 — 대표 정류소 도착정보를 수집·저장.

cron/작업스케줄러가 1~2분 주기로 호출:
  */2 * * * *  cd /app/server && venv/bin/python manage.py crawl_arrivals

앱(ArrivalView)은 live TAGO 실패 시 이 스냅샷을 폴백으로 사용한다.
오래된 스냅샷(TTL의 12배)은 매 실행 시 정리해 테이블이 무한히 커지지 않게 한다.
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.trips.models import ArrivalSnapshot
from apps.trips.services import tago_client


class Command(BaseCommand):
    help = "대표 정류소 TAGO 도착정보를 수집해 ArrivalSnapshot에 저장"

    def handle(self, *args, **options):
        stations = getattr(settings, "TAGO_CRAWL_STATIONS", [])
        saved = 0
        for city_code, node_id, label in stations:
            try:
                arrivals = tago_client.get_arrivals(city_code, node_id)
            except Exception as e:
                self.stderr.write(f"[{label}] 수집 실패: {e}")
                continue
            ArrivalSnapshot.objects.bulk_create([
                ArrivalSnapshot(
                    city_code=city_code, node_id=node_id,
                    route_no=a["route_name"], route_id=a["route_id"],
                    minutes=a["minutes"], stations_left=a["stations_left"],
                ) for a in arrivals
            ])
            saved += len(arrivals)
            self.stdout.write(f"[{label}] {len(arrivals)}건")

        # 오래된 스냅샷 정리 (TTL의 12배 넘은 것)
        ttl = getattr(settings, "ARRIVAL_SNAPSHOT_TTL", 300)
        cutoff = timezone.now() - timedelta(seconds=ttl * 12)
        deleted, _ = ArrivalSnapshot.objects.filter(collected_at__lt=cutoff).delete()
        self.stdout.write(self.style.SUCCESS(f"수집 {saved}건 저장, 오래된 {deleted}건 삭제"))
