import type { AppRoute } from './types';

export const routes: ReadonlyArray<{ path: AppRoute; label: string; shortLabel: string; symbol: string }> = [
  { path: '/tong-quan', label: 'Tổng quan', shortLabel: 'Tổng quan', symbol: '⌂' },
  { path: '/dieu-khien', label: 'Điều khiển', shortLabel: 'Điều khiển', symbol: '◉' },
  { path: '/trang-thai-phong', label: 'Trạng thái phòng', shortLabel: 'Hồ sơ', symbol: '◇' },
  { path: '/cai-dat-tu-dong', label: 'Cài đặt tự động', shortLabel: 'Cài đặt', symbol: '⚙' },
  { path: '/an-ninh-an-toan', label: 'An ninh & An toàn', shortLabel: 'An toàn', symbol: '⬡' },
  { path: '/lich-su', label: 'Lịch sử', shortLabel: 'Lịch sử', symbol: '↗' },
  { path: '/nhat-ky', label: 'Nhật ký', shortLabel: 'Nhật ký', symbol: '≡' }
];

const knownRoutes = new Set<AppRoute>(['/dang-nhap', ...routes.map((route) => route.path)]);

export function normalizeRoute(pathname: string): AppRoute {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return knownRoutes.has(normalized as AppRoute) ? (normalized as AppRoute) : '/tong-quan';
}

export function guardedRoute(route: AppRoute, authenticated: boolean): AppRoute {
  if (!authenticated) return '/dang-nhap';
  return route === '/dang-nhap' ? '/tong-quan' : route;
}

export function routeLabel(route: AppRoute): string {
  if (route === '/dang-nhap') return 'Đăng nhập';
  return routes.find((item) => item.path === route)?.label ?? 'Tổng quan';
}
