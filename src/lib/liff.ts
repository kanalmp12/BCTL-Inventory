import liff from "@line/liff";

export async function initLiff() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    console.warn("NEXT_PUBLIC_LIFF_ID is not defined.");
    return false;
  }
  try {
    await liff.init({ liffId });
    return liff.isLoggedIn();
  } catch (error) {
    console.error("LINE LIFF initialization failed:", error);
    return false;
  }
}

export function loginWithLine() {
  try {
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
    } else {
      window.location.reload();
    }
  } catch (error) {
    console.error("LINE login failed:", error);
  }
}

export function logoutFromLine() {
  try {
    if (liff.isLoggedIn()) {
      liff.logout();
    }
  } catch (error) {
    console.error("LINE logout failed:", error);
  } finally {
    localStorage.removeItem("toolCribUserId");
    localStorage.removeItem("toolCribUserInfo");
    localStorage.removeItem("bctl_cart_borrow");
    localStorage.removeItem("bctl_cart_return");
    window.location.href = window.location.origin + window.location.pathname;
  }
}

export async function getLineProfile() {
  try {
    if (liff.isLoggedIn()) {
      return await liff.getProfile();
    }
  } catch (error) {
    console.error("Failed to retrieve LINE profile:", error);
  }
  return null;
}

export function getLineIdToken() {
  try {
    if (liff.isLoggedIn()) {
      return liff.getIDToken();
    }
  } catch (error) {
    console.error("Failed to retrieve LINE ID Token:", error);
  }
  return null;
}
