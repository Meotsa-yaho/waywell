"""전국 그늘막쉼터 데이터를 API에서 받아 로컬 파일에 저장한다 (주기적/수동 실행).

    python manage.py import_shades
"""
from django.core.management.base import BaseCommand

from apps.places.services import shade_store


class Command(BaseCommand):
    help = "전국 그늘막쉼터 표준데이터를 내려받아 로컬(shades.json)에 저장"

    def handle(self, *args, **options):
        n = shade_store.refresh()
        self.stdout.write(self.style.SUCCESS(f"그늘막 {n}건 저장 완료 → {shade_store._FILE}"))
