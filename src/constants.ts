export interface PhotoSize {
  name: string;
  widthMm: number;
  heightMm: number;
  dpi: number;
}

export interface BgColor {
  name: string;
  hex: string;
}

export const PHOTO_SIZES: PhotoSize[] = [
  { name: '一寸 (25×35mm)', widthMm: 25, heightMm: 35, dpi: 300 },
  { name: '小一寸 (22×32mm)', widthMm: 22, heightMm: 32, dpi: 300 },
  { name: '二寸 (35×49mm)', widthMm: 35, heightMm: 49, dpi: 300 },
  { name: '小二寸 (35×45mm)', widthMm: 35, heightMm: 45, dpi: 300 },
  { name: '护照 (33×48mm)', widthMm: 33, heightMm: 48, dpi: 300 },
  { name: '美国签证 (51×51mm)', widthMm: 51, heightMm: 51, dpi: 300 },
  { name: '日本签证 (45×45mm)', widthMm: 45, heightMm: 45, dpi: 300 },
  { name: '韩国签证 (35×45mm)', widthMm: 35, heightMm: 45, dpi: 300 },
];

export const BG_COLORS: BgColor[] = [
  { name: '白色', hex: '#FFFFFF' },
  { name: '蓝色', hex: '#438EDB' },
  { name: '红色', hex: '#D9001B' },
  { name: '浅蓝', hex: '#6BAED6' },
  { name: '灰色', hex: '#C0C0C0' },
];

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}
