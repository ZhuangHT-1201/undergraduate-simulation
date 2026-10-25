GameGlobal.canvas = wx.createCanvas();

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {};
const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
const screenWidth = Number(windowInfo.screenWidth || deviceInfo.screenWidth || 375);
const screenHeight = Number(windowInfo.screenHeight || deviceInfo.screenHeight || 667);
const pixelRatio = Number(windowInfo.pixelRatio || deviceInfo.pixelRatio || 1);
const dpr = Math.max(1, Math.min(2, pixelRatio));

canvas.width = Math.floor(screenWidth * dpr);
canvas.height = Math.floor(screenHeight * dpr);
const ctx = canvas.getContext('2d');
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const menuRect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
const safeArea = windowInfo.safeArea || deviceInfo.safeArea || {};
const safeTopInset = Math.max(10, Number(safeArea.top || 0));
const safeTop = menuRect ? Math.max(safeTopInset, menuRect.bottom + 6) : safeTopInset + 10;
const safeBottom = Math.max(
  10,
  Math.round(Number(screenHeight - Number(safeArea.bottom || screenHeight)) + 10),
);

export const SCREEN_WIDTH = screenWidth;
export const SCREEN_HEIGHT = screenHeight;
export const DEVICE_PIXEL_RATIO = dpr;
export const SAFE_TOP = safeTop;
export const SAFE_BOTTOM = safeBottom;
