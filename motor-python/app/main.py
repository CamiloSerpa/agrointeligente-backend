import random
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime

from app import db
from app.analisis import analizar

app = FastAPI(
    title="AgroInteligente — Motor de Análisis",
    version="1.0.0",
)


class AnalisisRequest(BaseModel):
    usuario_id: str
    cultivo_id: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "servicio": "motor-python",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/analizar")
def endpoint_analizar(req: AnalisisRequest):
    cultivos = db.query(
        "SELECT * FROM cultivos WHERE id = %s AND usuario_id = %s",
        (req.cultivo_id, req.usuario_id),
    )
    if not cultivos:
        raise HTTPException(status_code=404, detail="Cultivo no encontrado")
    cultivo = cultivos[0]

    clima_reciente = db.query(
        """
        SELECT temperatura, humedad, prob_lluvia, precipitacion_mm, viento_kmh
          FROM clima_registros
         WHERE usuario_id = %s
           AND fecha > NOW() - INTERVAL '24 hours'
         ORDER BY fecha DESC
         LIMIT 24
        """,
        (req.usuario_id,),
    )

    todas = analizar(cultivo, clima_reciente)

    existentes = db.query(
        "SELECT titulo FROM recomendaciones WHERE usuario_id = %s AND cultivo_id = %s",
        (req.usuario_id, req.cultivo_id),
    )
    titulos_existentes = {r["titulo"] for r in existentes}

    nuevas = [r for r in todas if r["titulo"] not in titulos_existentes]

    if not nuevas:
        nuevas = todas

    elegida = random.choice(nuevas)

    result = db.execute(
        """
        INSERT INTO recomendaciones (
            usuario_id, cultivo_id, titulo, descripcion, tag, generada_por_ia
        ) VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, titulo, tag, generada_por_ia, creado_en
        """,
        (
            req.usuario_id,
            req.cultivo_id,
            elegida["titulo"],
            elegida["descripcion"],
            elegida["tag"],
            elegida["generada_por_ia"],
        ),
    )

    insertada = result[0] if result else None

    return {
        "cultivo_id": req.cultivo_id,
        "total_generadas": 1 if insertada else 0,
        "recomendaciones": [insertada] if insertada else [],
    }
