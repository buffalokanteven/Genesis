/**
 * Catálogo STILL Wellness
 * ------------------------------------------------------------------
 * Precios en MXN. El modelo dropshipping se basa en:
 *   supplierCost  -> lo que pagas al proveedor (producto + su envío nacional aprox.)
 *   price         -> precio de venta al público en la tienda
 *   margin        -> price - supplierCost  (tu utilidad bruta por pieza)
 *
 * Los costos de proveedor son ESTIMADOS a partir de la investigación de mercado
 * (CJ Dropshipping, AliExpress Business, Alibaba, Faire y fabricantes MX).
 * Ajústalos con las cotizaciones reales de tu proveedor antes de lanzar.
 *
 * `supplierSku` es el identificador del producto en el catálogo del proveedor.
 * Se usa para generar automáticamente la orden de compra cuando entra un pedido.
 */

export const products = [
  {
    id: "yoga-mat-tpe-6mm",
    slug: "tapete-yoga-tpe-6mm",
    name: "Tapete de Yoga TPE 6mm",
    subtitle: "Antideslizante · ecológico · con correa",
    category: "Yoga",
    price: 499,
    compareAt: 799,
    supplierCost: 185,
    supplierSku: "CJ-YOGA-TPE6-001",
    weightKg: 1.1,
    dimsCm: { length: 61, width: 15, height: 15 },
    colors: ["Arena", "Océano", "Piedra"],
    image: "/img/yoga-mat.svg",
    badge: "Más vendido",
    description:
      "Superficie de doble cara con textura antideslizante en TPE libre de látex. 6mm de amortiguación para articulaciones. Ligero y enrollable, ideal para práctica en casa o estudio.",
    specs: ["Material TPE ecológico", "183 × 61 cm", "6 mm de grosor", "Incluye correa de transporte"],
  },
  {
    id: "yoga-mat-pro-8mm",
    slug: "tapete-yoga-pro-8mm",
    name: "Tapete de Yoga PRO 8mm",
    subtitle: "Alta densidad · extra amortiguación",
    category: "Yoga",
    price: 649,
    compareAt: 999,
    supplierCost: 240,
    supplierSku: "CJ-YOGA-PRO8-002",
    weightKg: 1.5,
    dimsCm: { length: 66, width: 16, height: 16 },
    colors: ["Salvia", "Arena", "Carbón"],
    image: "/img/yoga-mat.svg",
    badge: null,
    description:
      "Grosor premium de 8mm para máxima estabilidad y confort en pilates, estiramiento y yoga restaurativo. Bordes reforzados y agarre húmedo/seco.",
    specs: ["Alta densidad NBR/TPE", "183 × 66 cm", "8 mm de grosor", "Correa + bolsa incluidas"],
  },
  {
    id: "weight-kit-adjustable",
    slug: "kit-pesas-ajustables",
    name: "Kit de Pesas Ajustables",
    subtitle: "Mancuernas modulares 2–10 kg",
    category: "Fuerza",
    price: 899,
    compareAt: 1399,
    supplierCost: 430,
    supplierSku: "CJ-WEIGHT-ADJ-010",
    weightKg: 6.0,
    dimsCm: { length: 35, width: 25, height: 20 },
    colors: ["Negro mate"],
    image: "/img/weights.svg",
    badge: "Nuevo",
    description:
      "Set de mancuernas ajustables con discos removibles. Ahorra espacio y reemplaza un rack completo. Acabado antideslizante y base protectora.",
    specs: ["Par ajustable 2–10 kg", "Discos de hierro recubierto", "Mango ergonómico", "Base protectora"],
  },
  {
    id: "resistance-bands-set",
    slug: "bandas-elasticas-tension",
    name: "Bandas Elásticas de Tensión",
    subtitle: "Set de 5 niveles · con anclaje",
    category: "Movilidad",
    price: 349,
    compareAt: 599,
    supplierCost: 95,
    supplierSku: "CJ-BAND-SET5-021",
    weightKg: 0.6,
    dimsCm: { length: 22, width: 16, height: 8 },
    colors: ["Multicolor"],
    image: "/img/bands.svg",
    badge: "Favorito",
    description:
      "Cinco bandas de látex por niveles de resistencia (X-ligero a X-fuerte). Incluye manijas, anclaje de puerta y correas para tobillo. Guía de rutinas descargable.",
    specs: ["5 niveles de tensión", "Manijas + anclaje de puerta", "Correas de tobillo", "Bolsa de transporte"],
  },
  {
    id: "pulley-hands-ankles",
    slug: "poleas-manos-tobillos",
    name: "Poleas para Manos y Tobillos",
    subtitle: "Sistema de polea doble + correas",
    category: "Movilidad",
    price: 399,
    compareAt: 699,
    supplierCost: 120,
    supplierSku: "CJ-PULLEY-DUAL-030",
    weightKg: 0.8,
    dimsCm: { length: 24, width: 18, height: 9 },
    colors: ["Negro"],
    image: "/img/pulley.svg",
    badge: null,
    description:
      "Sistema de poleas con correas acolchadas para manos y tobillos. Ideal para rehabilitación, movilidad de hombro y trabajo de fuerza controlada en casa.",
    specs: ["Polea doble reforzada", "Correas acolchadas mano/tobillo", "Anclaje de puerta", "Longitud ajustable"],
  },
];

export const productById = (id) => products.find((p) => p.id === id);

export const catalogStats = () => {
  const totalMargin = products.reduce((s, p) => s + (p.price - p.supplierCost), 0);
  return {
    count: products.length,
    avgMargin: Math.round(totalMargin / products.length),
  };
};
