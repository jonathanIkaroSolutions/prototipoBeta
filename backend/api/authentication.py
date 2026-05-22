from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class TolerantTokenAuthentication(TokenAuthentication):
    """
    Autenticación por token que NO lanza 401 si el token es inválido.
    En desarrollo, permite que requests con tokens falsos pasen como anónimos
    en vez de ser rechazados.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            # Token inválido → tratar como request anónimo
            return None
