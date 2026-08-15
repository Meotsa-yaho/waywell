"""기상청 격자 변환 + 체감온도 계산."""
import math


def latlng_to_grid(lat: float, lng: float) -> tuple[int, int]:
    """위경도(WGS84) → 기상청 단기예보 격자(nx, ny). LCC DFS 공개 로직."""
    RE, GRID = 6371.00877, 5.0
    SLAT1, SLAT2, OLON, OLAT, XO, YO = 30.0, 60.0, 126.0, 38.0, 43, 136
    DEGRAD = math.pi / 180.0

    re = RE / GRID
    slat1, slat2 = SLAT1 * DEGRAD, SLAT2 * DEGRAD
    olon, olat = OLON * DEGRAD, OLAT * DEGRAD

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / math.pow(ro, sn)

    ra = math.tan(math.pi * 0.25 + lat * DEGRAD * 0.5)
    ra = re * sf / math.pow(ra, sn)
    theta = lng * DEGRAD - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn

    nx = int(ra * math.sin(theta) + XO + 0.5)
    ny = int(ro - ra * math.cos(theta) + YO + 0.5)
    return nx, ny


def apparent_temperature(temp: float, humidity: float, wind: float) -> float:
    """호주 기상국(BOM) 체감온도(Apparent Temperature). 사계절 적용 가능.

    e = 수증기압(hPa), AT = Ta + 0.33e - 0.70ws - 4.00
    """
    e = (humidity / 100.0) * 6.105 * math.exp(17.27 * temp / (237.7 + temp))
    return round(temp + 0.33 * e - 0.70 * wind - 4.00, 1)
