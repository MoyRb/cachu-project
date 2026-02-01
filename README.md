This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Flujo operativo (Kiosco → Cocina)

### Variables de entorno (PINs de estación)

Puedes configurar los PINs con variables públicas. Si no se definen, se usan los valores por defecto:

- `NEXT_PUBLIC_KITCHEN_PIN_PLANCHA` (default: `1111`)
- `NEXT_PUBLIC_KITCHEN_PIN_FREIDORA` (default: `2222`)
- `NEXT_PUBLIC_KITCHEN_PIN_EMPAQUETADO` (default: `3333`)

### Prueba rápida en UI (paso a paso)

1. Inicia el servidor (`npm run dev`).
2. Abre `/kiosco` y crea un pedido DINEIN o TAKEOUT.
3. Confirma el pedido y verifica el mensaje “Pedido #XXX”.
4. Abre `/cocina` y selecciona **Plancha** (PIN por defecto: `1111`).
5. Marca los items de plancha: `EN_COLA` → `EN_PREPARACION` → `LISTO`.
6. Selecciona **Freidora** (PIN por defecto: `2222`) y marca sus items hasta `LISTO`.
7. Cuando todo esté listo, entra a **Empaquetado** (PIN por defecto: `3333`).
8. Cambia el pedido a `EMPACANDO`, luego a `LISTO_PARA_ENTREGAR`.
9. Si es DELIVERY, usa `EN_REPARTO`; en caso contrario, marca `ENTREGADO`.
10. Verifica que el pedido desaparezca de plancha/freidora y se actualice en empaquetado.

### Endpoint de salud

- `GET /api/health` → responde `200 OK` con `{ status: "ok" }`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API testing checklist (cURL)

> Todos los endpoints requieren headers de desarrollo: `X-ROLE` y `X-USER-ID`.

- Crear pedido (EMPAQUETADO o ADMIN):

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "X-ROLE: EMPAQUETADO" \
  -H "X-USER-ID: 1" \
  -d '{
    "type": "TAKEOUT",
    "customer_name": "Cliente Demo",
    "customer_phone": "5551234567",
    "items": [
      {
        "product_id": 1,
        "name_snapshot": "Hamburguesa clásica",
        "price_cents_snapshot": 9900,
        "qty": 1,
        "station": "PLANCHA"
      },
      {
        "product_id": 4,
        "name_snapshot": "Papas",
        "price_cents_snapshot": 4500,
        "qty": 1,
        "station": "FREIDORA"
      }
    ]
  }'
```

- Listar pedidos por rol (ej. PLANCHA):

```bash
curl "http://localhost:3000/api/orders?status=RECIBIDO" \
  -H "X-ROLE: PLANCHA" \
  -H "X-USER-ID: 2"
```

- Actualizar item por estación (PLANCHA/FREIDORA):

```bash
curl -X PATCH http://localhost:3000/api/order-items/1 \
  -H "Content-Type: application/json" \
  -H "X-ROLE: PLANCHA" \
  -H "X-USER-ID: 2" \
  -d '{ "status": "LISTO" }'
```

- Actualizar pedido por empaquetado:

```bash
curl -X PATCH http://localhost:3000/api/orders/1 \
  -H "Content-Type: application/json" \
  -H "X-ROLE: EMPAQUETADO" \
  -H "X-USER-ID: 4" \
  -d '{ "status": "EMPACANDO" }'
```

- Verificar transición automática a `LISTO_PARA_EMPACAR`:

```bash
curl http://localhost:3000/api/orders/1 \
  -H "X-ROLE: ADMIN" \
  -H "X-USER-ID: 1"
```
