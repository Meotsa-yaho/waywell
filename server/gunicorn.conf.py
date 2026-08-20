"""gunicorn 실행 설정 — systemd ExecStart를 짧게 유지하기 위한 파일.

gunicorn은 작업 디렉터리의 gunicorn.conf.py를 자동으로 읽는다.
systemd 유닛에는 `ExecStart=.../gunicorn config.wsgi:application` 한 줄만 두면 된다.
(가비아 브라우저 콘솔은 긴 줄을 붙여넣을 때 잘리고 역슬래시가 | 로 들어가서,
 옵션을 유닛 파일에 늘어놓으면 실제로 기동이 실패했다.)
"""
bind = "127.0.0.1:8000"
workers = 3  # 2vCore 기준
# 경로 조회가 Tmap·기상청·에어코리아를 연달아 호출해 기본 30초로는 끊긴다.
timeout = 90
