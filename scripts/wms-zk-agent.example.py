#!/usr/bin/env python3
"""
Agente local ZKTeco → Campo Norte (ejemplo).

El navegador NO habla el puerto 4370. Este proceso corre en la LAN del
almacén, lee punches reales con pyzk y los imprime como JSON para pegar
en «Jornada de planta», o los POST a un ingest cuando exista backend.

Dependencia: pip install pyzk
Repo: https://github.com/fananimi/pyzk

No inventa lecturas: si no hay terminal, no hay punch.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone


def punch_payload(operator_id: str, kind: str, device_id: str, at: datetime | None = None) -> dict:
    when = at or datetime.now(timezone.utc)
    return {
        "operatorId": operator_id,
        "kind": kind,  # entrada | salida
        "at": when.isoformat().replace("+00:00", "Z"),
        "deviceId": device_id,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Campo Norte · agente ZKTeco de ejemplo")
    parser.add_argument("--address", default="", help="IP del terminal (vacío = no conectar)")
    parser.add_argument("--port", type=int, default=4370)
    parser.add_argument("--device-id", default="ZK-SEV-01")
    parser.add_argument("--operator-id", default="op-08")
    parser.add_argument("--kind", choices=("entrada", "salida"), default="entrada")
    args = parser.parse_args()

    if not args.address:
        print("# Sin --address no hay telemetría. Payload de contrato:")
        print(json.dumps(punch_payload(args.operator_id, args.kind, args.device_id), indent=2))
        print("# Con terminal: pip install pyzk && python scripts/wms-zk-agent.example.py --address 192.168.1.201")
        return

    from zk import ZK  # type: ignore

    zk = ZK(args.address, port=args.port, timeout=5)
    conn = zk.connect()
    try:
        for att in conn.get_attendance() or []:
            kind = "entrada" if getattr(att, "punch", 0) == 0 else "salida"
            print(
                json.dumps(
                    punch_payload(
                        args.operator_id,
                        kind,
                        args.device_id,
                        getattr(att, "timestamp", None),
                    )
                )
            )
    finally:
        conn.disconnect()


if __name__ == "__main__":
    main()
