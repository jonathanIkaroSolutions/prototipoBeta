"""
Módulo de geocodificación usando Google Geocoding API.

Valida direcciones y obtiene coordenadas (lat/lng) para asegurar
que las direcciones sean encontrables en Google Maps.
"""
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Cache en memoria para evitar llamadas repetidas durante una importación
_geocode_cache: dict[str, dict | None] = {}


def geocodificar_direccion(direccion: str, ciudad: str = 'Zaragoza', 
                           codigo_postal: str = '') -> dict | None:
    """
    Geocodifica una dirección usando Google Geocoding API.
    
    Args:
        direccion: Calle y número (ej: "Paseo de la Independencia 15")
        ciudad: Ciudad (default: Zaragoza)
        codigo_postal: CP opcional para mejorar precisión
    
    Returns:
        Dict con {lat, lng, formatted_address} o None si no se pudo geocodificar.
        
    Ejemplo retorno:
        {
            'lat': 41.6488,
            'lng': -0.8891,
            'formatted_address': 'P.º de la Independencia, 15, 50004 Zaragoza, España'
        }
    """
    api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
    if not api_key:
        logger.warning("GOOGLE_MAPS_API_KEY no configurada. Geocodificación deshabilitada.")
        return None
    
    # Construir dirección completa para búsqueda
    partes = [direccion]
    if codigo_postal:
        partes.append(codigo_postal)
    partes.append(ciudad)
    partes.append('España')
    
    address_query = ', '.join(p for p in partes if p)
    
    # Check cache
    if address_query in _geocode_cache:
        return _geocode_cache[address_query]
    
    try:
        response = requests.get(
            'https://maps.googleapis.com/maps/api/geocode/json',
            params={
                'address': address_query,
                'key': api_key,
                'language': 'es',
                'region': 'es',
                # Sesgo hacia Zaragoza para mejorar resultados
                'bounds': '41.60,-0.95|41.70,-0.83',
            },
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'OK' and data['results']:
            result = data['results'][0]
            location = result['geometry']['location']
            
            geocode_result = {
                'lat': location['lat'],
                'lng': location['lng'],
                'formatted_address': result['formatted_address'],
            }
            
            # Validar que el resultado está en la zona de Zaragoza (±0.15 grados)
            if not _esta_en_zaragoza(location['lat'], location['lng']):
                logger.warning(
                    f"Geocoding devolvió ubicación fuera de Zaragoza para '{address_query}': "
                    f"({location['lat']}, {location['lng']})"
                )
                _geocode_cache[address_query] = None
                return None
            
            _geocode_cache[address_query] = geocode_result
            return geocode_result
        
        elif data['status'] == 'ZERO_RESULTS':
            logger.warning(f"No se encontró dirección: '{address_query}'")
            _geocode_cache[address_query] = None
            return None
        
        else:
            logger.error(f"Error Geocoding API ({data['status']}): {data.get('error_message', '')}")
            return None
    
    except requests.RequestException as e:
        logger.error(f"Error de red en geocodificación: {e}")
        return None


def geocodificar_cliente(cliente) -> bool:
    """
    Geocodifica un cliente y guarda las coordenadas en el modelo.
    
    Args:
        cliente: Instancia de Cliente (se modifica y guarda in-place)
    
    Returns:
        True si se geocodificó correctamente, False en caso contrario
    """
    resultado = geocodificar_direccion(
        direccion=cliente.direccion,
        ciudad=cliente.ciudad,
        codigo_postal=cliente.codigo_postal,
    )
    
    if resultado:
        cliente.latitud = resultado['lat']
        cliente.longitud = resultado['lng']
        cliente.direccion_formateada = resultado['formatted_address']
        cliente.geocodificado = True
        cliente.save(update_fields=['latitud', 'longitud', 'direccion_formateada', 'geocodificado'])
        return True
    else:
        cliente.geocodificado = False
        cliente.save(update_fields=['geocodificado'])
        return False


def geocodificar_lote(clientes_queryset) -> dict:
    """
    Geocodifica un lote de clientes (útil para reprocesar direcciones).
    
    Returns:
        Dict con estadísticas: {total, exitosos, fallidos, errores: [...]}
    """
    resultado = {
        'total': 0,
        'exitosos': 0,
        'fallidos': 0,
        'errores': [],
    }
    
    for cliente in clientes_queryset:
        resultado['total'] += 1
        ok = geocodificar_cliente(cliente)
        if ok:
            resultado['exitosos'] += 1
        else:
            resultado['fallidos'] += 1
            resultado['errores'].append(
                f"No se pudo geocodificar: {cliente.nombre} - {cliente.direccion}, {cliente.ciudad}"
            )
    
    return resultado


def limpiar_cache():
    """Limpia la cache de geocodificación en memoria."""
    global _geocode_cache
    _geocode_cache = {}


def _esta_en_zaragoza(lat: float, lng: float) -> bool:
    """Verifica que las coordenadas están dentro del área metropolitana de Zaragoza."""
    # Zaragoza centro ≈ 41.65, -0.88
    # Margen amplio para cubrir toda la ciudad y alrededores
    return (41.55 <= lat <= 41.80) and (-1.05 <= lng <= -0.70)
