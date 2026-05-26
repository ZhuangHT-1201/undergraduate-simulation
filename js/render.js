GameGlobal.canvas = wx.createCanvas();

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {};
const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
const screenWidth = Number(windowInfo.screenWidth || deviceInfo.screenWidth || 375);
const screenHeight = Number(windowInfo.screenHeight || deviceInfo.screenHeight || 667);
const pixelRatio = Number(windowInfo.pixelRatio || deviceInfo.pixelRatio || 1);
const dpr = Math.max(1, pixelRatio);

canvas.width = Math.floor(screenWidth * dpr);
canvas.height = Math.floor(screenHeight * dpr);
const ctx = canvas.getContext('2d');
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
const menuRect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
const safeTopInset = Math.max(10, Number(windowInfo.safeArea?.top || deviceInfo.safeArea?.top || 0));
const safeTop = menuRect ? Math.max(safeTopInset, menuRect.bottom + 6) : safeTopInset + 10;

export const SCREEN_WIDTH = screenWidth;
export const SCREEN_HEIGHT = screenHeight;
export const DEVICE_PIXEL_RATIO = dpr;
export const SAFE_TOP = safeTop;