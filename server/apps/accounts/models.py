import uuid

from django.db import models


class Account(models.Model):
    """회원. 이메일 가입 또는 카카오 로그인. 게스트(device_id)에서 승격."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, null=True, blank=True)
    password = models.CharField(max_length=128, blank=True, default="")  # Django 해시(PBKDF2), 카카오면 비움
    kakao_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    nickname = models.CharField(max_length=60, blank=True, default="")
    preset = models.CharField(max_length=16, default="normal")
    device_id = models.CharField(max_length=64, blank=True, default="", db_index=True)  # 가입 시점 게스트 기기
    created_at = models.DateTimeField(auto_now_add=True)
