export function formatElapsed(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return "";
  }

  const diffMs = Date.now() - created;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes <= 0) {
    return "Hace instantes";
  }
  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return `Hace ${diffHours} h ${remainingMinutes} min`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

export function formatOrderType(type: string) {
  switch (type) {
    case "DINEIN":
      return "Comer aquí";
    case "TAKEOUT":
      return "Para llevar";
    case "DELIVERY":
      return "Delivery";
    default:
      return type;
  }
}

export function formatItemStatus(status: string) {
  switch (status) {
    case "EN_COLA":
      return "En cola";
    case "PENDIENTE":
      return "Pendiente";
    case "EN_PREPARACION":
      return "En preparación";
    case "LISTO":
      return "Listo";
    default:
      return status;
  }
}

export function formatOrderStatus(status: string) {
  switch (status) {
    case "RECIBIDO":
      return "Recibido";
    case "EN_PROCESO":
      return "En proceso";
    case "LISTO_PARA_EMPACAR":
      return "Listo para empacar";
    case "EMPACANDO":
      return "Empacando";
    case "LISTO_PARA_ENTREGAR":
      return "Listo para entregar";
    case "EN_REPARTO":
      return "En reparto";
    case "ENTREGADO":
      return "Entregado";
    default:
      return status;
  }
}
