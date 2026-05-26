from datetime import datetime


def _dias_desde_siembra(fecha_siembra) -> int:
    if isinstance(fecha_siembra, datetime):
        hoy = datetime.now(fecha_siembra.tzinfo) if fecha_siembra.tzinfo else datetime.now()
        return (hoy - fecha_siembra).days
    return (datetime.now().date() - fecha_siembra).days


def _stats_clima(clima_reciente: list) -> dict:
    if not clima_reciente:
        return {}

    humedades     = [r["humedad"]       for r in clima_reciente if r.get("humedad")       is not None]
    temperaturas  = [r["temperatura"]   for r in clima_reciente if r.get("temperatura")   is not None]
    lluvias       = [r["prob_lluvia"]   for r in clima_reciente if r.get("prob_lluvia")   is not None]
    precipitacion = [r["precipitacion_mm"] for r in clima_reciente if r.get("precipitacion_mm") is not None]
    viento        = [r["viento_kmh"]    for r in clima_reciente if r.get("viento_kmh")    is not None]

    return {
        "humedad_avg":      sum(humedades)    / len(humedades)    if humedades    else None,
        "temp_avg":         sum(temperaturas) / len(temperaturas) if temperaturas else None,
        "temp_max":         max(temperaturas)                     if temperaturas else None,
        "lluvia_avg":       sum(lluvias)      / len(lluvias)      if lluvias      else None,
        "precipitacion_mm": sum(precipitacion)                    if precipitacion else 0,
        "viento_avg":       sum(viento)       / len(viento)       if viento       else None,
    }


def _recos_maiz(cultivo: dict, stats: dict) -> list:
    recos = []
    dias  = _dias_desde_siembra(cultivo["fecha_siembra"])
    estado = cultivo["estado"]

    if estado == "siembra":
        recos.append({
            "titulo": "Prepare el suelo para la germinación",
            "descripcion": (
                "Asegure una humedad uniforme en los primeros 5 cm. "
                "La temperatura del suelo ideal para germinar maíz es entre 18°C y 30°C."
            ),
            "tag": "Siembra",
            "generada_por_ia": True,
        })

    if estado == "germinacion":
        if dias <= 14:
            recos.append({
                "titulo": "Riego frecuente en etapa de germinación",
                "descripcion": (
                    f"Con {dias} días desde la siembra el maíz está en etapa crítica. "
                    "Mantenga la humedad constante — riegos cortos cada 2 días son preferibles a riegos largos y espaciados."
                ),
                "tag": "Riego",
                "generada_por_ia": True,
            })
        if 5 <= dias <= 20:
            humedad_ok = stats.get("humedad_avg") is None or stats.get("humedad_avg", 100) >= 45
            if humedad_ok:
                recos.append({
                    "titulo": "Momento óptimo para fertilización de arranque",
                    "descripcion": (
                        f"Su maíz lleva {dias} días en germinación. "
                        "Aplique urea (46-0-0) al voleo o NPK 15-15-15 a 30 cm del tallo. "
                        "Una buena fertilización inicial define el rendimiento del lote."
                    ),
                    "tag": "Fertilización",
                    "generada_por_ia": True,
                })

    if estado == "crecimiento":
        recos.append({
            "titulo": "Segunda fertilización nitrogenada",
            "descripcion": (
                "En etapa de crecimiento el maíz demanda alto nitrógeno. "
                "Aplique urea fraccionada (mitad ahora, mitad en 15 días) para maximizar la absorción."
            ),
            "tag": "Fertilización",
            "generada_por_ia": True,
        })
        recos.append({
            "titulo": "Control de malezas urgente",
            "descripcion": (
                "Las malezas compiten directamente por nutrientes en esta etapa. "
                "Aplique herbicida post-emergente o realice deshierba manual antes de que superen 15 cm."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })

    if estado == "floracion":
        recos.append({
            "titulo": "Etapa crítica: no deje faltar agua",
            "descripcion": (
                "La floración es la etapa más sensible al estrés hídrico en el maíz. "
                "Un déficit de agua en este momento puede reducir el rendimiento hasta un 50%. "
                "Garantice riego si no hay lluvia en los próximos 3 días."
            ),
            "tag": "Riego",
            "generada_por_ia": True,
        })
        if dias > 70:
            recos.append({
                "titulo": "Prepare la logística de cosecha",
                "descripcion": (
                    f"Con {dias} días y en floración avanzada, la cosecha se aproxima en 2-3 semanas. "
                    "Reserve mano de obra, revise equipos y coordine transporte."
                ),
                "tag": "Cosecha",
                "generada_por_ia": True,
            })

    if estado == "cosecha":
        recos.append({
            "titulo": "Verifique madurez antes de cosechar",
            "descripcion": (
                "El maíz está listo cuando el grano tiene humedad entre 20-25% "
                "y la capa negra en la base del grano es visible. "
                "Cosechar antes reduce rendimiento; después aumenta pérdidas por hongos."
            ),
            "tag": "Cosecha",
            "generada_por_ia": True,
        })

    return recos


def _recos_cafe(cultivo: dict, stats: dict) -> list:
    recos = []
    estado = cultivo["estado"]
    dias   = _dias_desde_siembra(cultivo["fecha_siembra"])

    if estado == "siembra":
        recos.append({
            "titulo": "Sombra temporal para el almácigo",
            "descripcion": (
                "Las plantas jóvenes de café necesitan 50-60% de sombra en los primeros meses. "
                "Use sarán o árboles de sombrío temporal para reducir el estrés hídrico."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })

    if estado in ("germinacion", "crecimiento"):
        recos.append({
            "titulo": "Fertilización con alto fósforo en etapa joven",
            "descripcion": (
                "El café en desarrollo necesita fósforo para enraizamiento. "
                "Aplique DAP (18-46-0) o un abono de alta concentración en P. "
                "Evite exceso de nitrógeno en esta etapa."
            ),
            "tag": "Fertilización",
            "generada_por_ia": True,
        })

    if estado == "floracion":
        recos.append({
            "titulo": "Aplicar NPK 15-15-15 durante la floración",
            "descripcion": (
                "La floración del café es el momento de mayor demanda nutricional. "
                "Dosis: 200 g por planta a 30 cm del tallo en surco superficial. "
                "Aplique con suelo húmedo para mejor absorción."
            ),
            "tag": "Fertilización",
            "generada_por_ia": True,
        })
        recos.append({
            "titulo": "Revise la presencia de broca",
            "descripcion": (
                "La floración y fructificación son las etapas de mayor riesgo de broca. "
                "Inspeccione el 10% de los frutos por árbol. Si hay más de 2-3% de afectación, "
                "aplique control biológico con Beauveria bassiana."
            ),
            "tag": "Prevención",
            "generada_por_ia": True,
        })

    if estado == "cosecha":
        recos.append({
            "titulo": "Recolección selectiva: solo granos rojos",
            "descripcion": (
                "Recolecte únicamente granos completamente rojos o amarillos según variedad. "
                "La mezcla de granos verdes reduce la calidad del café y el precio de venta."
            ),
            "tag": "Cosecha",
            "generada_por_ia": True,
        })

    return recos


def _recos_platano(cultivo: dict, stats: dict) -> list:
    recos = []
    estado = cultivo["estado"]

    if estado in ("siembra", "germinacion"):
        recos.append({
            "titulo": "Desinfecte los colinos antes de sembrar",
            "descripcion": (
                "Sumerja los colinos en una solución de hipoclorito (2 cc/litro) por 15 minutos "
                "para prevenir Fusarium y Sigatoka desde el inicio del cultivo."
            ),
            "tag": "Prevención",
            "generada_por_ia": True,
        })

    if estado == "crecimiento":
        recos.append({
            "titulo": "Deshije y selección de hijo de espada",
            "descripcion": (
                "Seleccione un hijo de espada por planta para la próxima cosecha. "
                "Elimine hijos de agua y plantas con síntomas de Sigatoka. "
                "Este manejo define la productividad del siguiente ciclo."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })
        recos.append({
            "titulo": "Fertilización potásica para el platanero",
            "descripcion": (
                "El plátano es el cultivo de mayor demanda de potasio. "
                "Aplique KCl (0-0-60) o Sulfato de potasio: 300-400 g por planta cada 3 meses."
            ),
            "tag": "Fertilización",
            "generada_por_ia": True,
        })

    if estado == "floracion":
        recos.append({
            "titulo": "Embolse del racimo para protegerlo",
            "descripcion": (
                "Cubra el racimo con bolsa plástica azul perforada en cuanto aparezca la bellota. "
                "Esto mejora la calidad de la fruta, acelera la maduración y reduce daños por insectos."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })

    if estado == "cosecha":
        recos.append({
            "titulo": "Coseche con el grosor adecuado del dedo",
            "descripcion": (
                "El platano para exportación se corta con 32 mm de diámetro mínimo (calibre 38-42). "
                "Para consumo nacional puede cosecharse un poco antes. "
                "Evite golpes al manipular el racimo."
            ),
            "tag": "Cosecha",
            "generada_por_ia": True,
        })

    return recos


def _recos_tomate(cultivo: dict, stats: dict) -> list:
    recos = []
    estado = cultivo["estado"]

    if estado in ("siembra", "germinacion"):
        recos.append({
            "titulo": "Trasplante en horas frescas",
            "descripcion": (
                "Realice el trasplante temprano en la mañana o al final de la tarde "
                "para reducir el estrés por calor. Riegue abundantemente las 24h previas al trasplante."
            ),
            "tag": "Siembra",
            "generada_por_ia": True,
        })

    if estado == "crecimiento":
        recos.append({
            "titulo": "Instale o revise el sistema de tutores",
            "descripcion": (
                "El tomate necesita soporte desde los 20-25 cm de altura. "
                "Use estacas de 1.5 m o sistema de espaldera con alambre. "
                "Tutores inadecuados generan pérdidas por pudrición de frutos."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })
        recos.append({
            "titulo": "Poda de formación y destallado",
            "descripcion": (
                "Elimine los tallos laterales (chupones) que salen entre el tallo principal y las ramas. "
                "En tomate de mesa maneje 1-2 tallos por planta para mayor tamaño de fruto."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })

    if estado == "floracion":
        recos.append({
            "titulo": "Aplicación de boro y calcio en floración",
            "descripcion": (
                "La deficiencia de calcio causa pudrición apical del fruto (una de las pérdidas más comunes). "
                "Aplique Nitrato de Calcio foliar (2 g/litro) cada 8 días durante la floración y cuajado."
            ),
            "tag": "Fertilización",
            "generada_por_ia": True,
        })

    if estado == "cosecha":
        recos.append({
            "titulo": "Cosecha escalonada para mejor precio",
            "descripcion": (
                "No espere a que todos los frutos maduren al mismo tiempo. "
                "Coseche en rojo-pintón (70-80% rojo) para reducir pérdidas y obtener mejor precio en el mercado."
            ),
            "tag": "Cosecha",
            "generada_por_ia": True,
        })

    return recos


def _recos_arroz(cultivo: dict, stats: dict) -> list:
    recos = []
    estado = cultivo["estado"]

    if estado in ("siembra", "germinacion"):
        recos.append({
            "titulo": "Control de nivel de agua en germinación",
            "descripcion": (
                "En arroz inundado mantenga lámina de 3-5 cm en germinación. "
                "En arroz secano, el suelo debe estar a capacidad de campo pero sin encharcamiento."
            ),
            "tag": "Riego",
            "generada_por_ia": True,
        })

    if estado == "crecimiento":
        recos.append({
            "titulo": "Control de malezas acuáticas",
            "descripcion": (
                "Las malezas en arroz compiten ferozmente los primeros 30 días. "
                "Aplique herbicidas selectivos para gramíneas o realice drenaje temporal para control."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })

    if estado == "floracion":
        recos.append({
            "titulo": "Aumento de lámina de agua en floración",
            "descripcion": (
                "La floración del arroz es muy sensible al estrés hídrico y a temperaturas bajas nocturnas. "
                "Aumente la lámina de agua a 10-15 cm para proteger la polinización."
            ),
            "tag": "Riego",
            "generada_por_ia": True,
        })

    if estado == "cosecha":
        recos.append({
            "titulo": "Drene el lote 15 días antes de cosechar",
            "descripcion": (
                "Inicie el drenaje del lote cuando el 80% de los granos estén dorados. "
                "Cosechar con exceso de humedad aumenta las pérdidas por trillado y el costo de secado."
            ),
            "tag": "Cosecha",
            "generada_por_ia": True,
        })

    return recos


def _recos_aguacate(cultivo: dict, stats: dict) -> list:
    recos = []
    estado = cultivo["estado"]

    if estado in ("siembra", "germinacion"):
        recos.append({
            "titulo": "Riego gota a gota recomendado para aguacate joven",
            "descripcion": (
                "El aguacate joven es muy sensible a la pudrición de raíz (Phytophthora). "
                "Use riego localizado para mantener humedad sin encharcamiento. "
                "Nunca riegue directamente sobre el cuello de la planta."
            ),
            "tag": "Riego",
            "generada_por_ia": True,
        })

    if estado == "crecimiento":
        recos.append({
            "titulo": "Aplicación de cal para el aguacate",
            "descripcion": (
                "El aguacate Hass necesita pH entre 5.5 y 7.0. "
                "Si el suelo es muy ácido, aplique cal dolomítica (500 g/planta) "
                "antes de la siguiente fertilización."
            ),
            "tag": "Fertilización",
            "generada_por_ia": True,
        })

    if estado == "floracion":
        recos.append({
            "titulo": "Favorezca los polinizadores en floración",
            "descripcion": (
                "El aguacate es una de las pocas frutas que depende de polinización cruzada. "
                "Evite fumigaciones durante la floración, especialmente en las mañanas. "
                "Si es posible, ubique colmenas cerca del cultivo."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })

    if estado == "cosecha":
        recos.append({
            "titulo": "Prueba de madurez para aguacate Hass",
            "descripcion": (
                "Coseche cuando el fruto cambie de verde brillante a verde oscuro-morado. "
                "Tome una muestra y déjela madurar a temperatura ambiente: si madura bien en 5-7 días, "
                "el lote está listo para cosechar."
            ),
            "tag": "Cosecha",
            "generada_por_ia": True,
        })

    return recos


def _recos_clima(stats: dict) -> list:
    recos = []
    if not stats:
        return recos

    humedad_avg  = stats.get("humedad_avg")
    temp_max     = stats.get("temp_max")
    lluvia_avg   = stats.get("lluvia_avg")
    precip_mm    = stats.get("precipitacion_mm", 0)
    viento_avg   = stats.get("viento_avg")

    if humedad_avg is not None and humedad_avg >= 75:
        recos.append({
            "titulo": "Humedad alta: riesgo de enfermedades fungosas",
            "descripcion": (
                f"La humedad promedio de las últimas 24h fue {humedad_avg:.0f}%. "
                "Condiciones favorables para hongos como Botrytis y Sigatoka. "
                "Aplique fungicida preventivo en horas sin lluvia y mejore la ventilación del cultivo."
            ),
            "tag": "Prevención",
            "generada_por_ia": True,
        })

    if lluvia_avg is not None and lluvia_avg >= 60:
        recos.append({
            "titulo": "Lluvia prevista: posponga fumigaciones",
            "descripcion": (
                f"La probabilidad de lluvia registrada fue del {lluvia_avg:.0f}%. "
                "Evite aplicaciones de pesticidas o fertilizantes foliares en estas condiciones — "
                "la lluvia los arrastra antes de ser absorbidos, generando pérdida de producto y costo."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })

    if precip_mm and precip_mm >= 5:
        recos.append({
            "titulo": "Aproveche la lluvia reciente para fertilizar",
            "descripcion": (
                f"Se registraron {precip_mm:.1f} mm de precipitación reciente. "
                "La humedad del suelo favorece la absorción de fertilizantes granulados. "
                "Es un buen momento para aplicar abono de fondo si lo tiene planificado."
            ),
            "tag": "Fertilización",
            "generada_por_ia": True,
        })

    if temp_max is not None and temp_max >= 32:
        recos.append({
            "titulo": "Temperatura alta: riegue en horas frescas",
            "descripcion": (
                f"La temperatura máxima registrada fue {temp_max:.1f}°C. "
                "Riegue temprano en la mañana (antes de las 8 am) o al final de la tarde (después de las 5 pm) "
                "para reducir la evaporación y el estrés térmico del cultivo."
            ),
            "tag": "Riego",
            "generada_por_ia": True,
        })

    if humedad_avg is not None and humedad_avg < 45:
        recos.append({
            "titulo": "Humedad baja: aumente la frecuencia de riego",
            "descripcion": (
                f"La humedad ambiental promedio fue {humedad_avg:.0f}%, por debajo del rango óptimo. "
                "Incremente los riegos especialmente en horas de mayor temperatura. "
                "Considere mulch o cobertura del suelo para retener la humedad."
            ),
            "tag": "Riego",
            "generada_por_ia": True,
        })

    if viento_avg is not None and viento_avg >= 20:
        recos.append({
            "titulo": "Viento fuerte: revise anclajes y protecciones",
            "descripcion": (
                f"Se registró viento promedio de {viento_avg:.0f} km/h. "
                "Verifique tutores, amarres y estructuras de sombrío. "
                "Posponga fumigaciones hasta que el viento baje de 15 km/h para evitar deriva."
            ),
            "tag": "Manejo",
            "generada_por_ia": True,
        })

    return recos


def analizar(cultivo: dict, clima_reciente: list[dict]) -> list[dict]:
    tipo  = cultivo["tipo"].lower().replace("á", "a").replace("é", "e")
    stats = _stats_clima(clima_reciente)
    recos = []

    if tipo == "maiz":
        recos += _recos_maiz(cultivo, stats)
    elif tipo in ("cafe", "café"):
        recos += _recos_cafe(cultivo, stats)
    elif tipo in ("platano", "plátano"):
        recos += _recos_platano(cultivo, stats)
    elif tipo == "tomate":
        recos += _recos_tomate(cultivo, stats)
    elif tipo == "arroz":
        recos += _recos_arroz(cultivo, stats)
    elif tipo in ("aguacate",):
        recos += _recos_aguacate(cultivo, stats)

    recos += _recos_clima(stats)

    recos.append({
        "titulo": "Control preventivo de plagas",
        "descripcion": (
            "Inspeccione el envés de las hojas esta semana. "
            "Período favorable para aparición de mosca blanca, ácaros y minadores. "
            "Detección temprana reduce el costo de control hasta un 70%."
        ),
        "tag": "Prevención",
        "generada_por_ia": True,
    })

    return recos
