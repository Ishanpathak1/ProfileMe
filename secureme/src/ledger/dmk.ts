"use client";

import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import AppEth from "@ledgerhq/hw-app-eth";
import { formatAttestationMessage } from "./attestationMessage";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as DMK from "@ledgerhq/device-management-kit"; // Imported to ensure the DMK bundle is available; we wrap transports here for browser usage.

export type LedgerDeviceInfo = {
  id: string;
  product?: string;
  transport: "hid" | "usb";
  opened?: boolean;
};

type EventName = "connected" | "disconnected" | "error";

type Listener = (payload: any) => void;

class DmkClient {
  private initialized = false;
  private currentTransport: TransportWebHID | TransportWebUSB | null = null;
  private currentDeviceInfo: LedgerDeviceInfo | null = null;
  private listeners: Record<EventName, Set<Listener>> = {
    connected: new Set(),
    disconnected: new Set(),
    error: new Set(),
  };

  private ensureInit(): void {
    if (this.initialized) return;
    try {
      if (typeof window !== "undefined") {
        if ((navigator as any).hid && (navigator as any).hid.addEventListener) {
          (navigator as any).hid.addEventListener("connect", () => {
            this.emit("connected", this.currentDeviceInfo);
          });
          (navigator as any).hid.addEventListener("disconnect", () => {
            this.handleDisconnect();
          });
        }
        if ((navigator as any).usb && (navigator as any).usb.addEventListener) {
          (navigator as any).usb.addEventListener("connect", () => {
            this.emit("connected", this.currentDeviceInfo);
          });
          (navigator as any).usb.addEventListener("disconnect", () => {
            this.handleDisconnect();
          });
        }
      }
    } catch (err) {
      // Ignore listener wiring errors
    }
    this.initialized = true;
  }

  private emit(event: EventName, payload: any): void {
    for (const cb of this.listeners[event]) {
      try {
        cb(payload);
      } catch {}
    }
  }

  private setDeviceFromHidDevice(device: HIDDevice): LedgerDeviceInfo {
    const id = `hid:${device.vendorId}:${device.productId}`;
    const info: LedgerDeviceInfo = {
      id,
      product: device.productName || "Ledger",
      transport: "hid",
      opened: device.opened,
    };
    return info;
  }

  private setDeviceFromUsbDevice(device: USBDevice): LedgerDeviceInfo {
    const serial = (device as any).serialNumber ? `:${(device as any).serialNumber}` : "";
    const id = `usb:${device.vendorId}:${device.productId}${serial}`;
    const info: LedgerDeviceInfo = {
      id,
      product: device.productName || "Ledger",
      transport: "usb",
      opened: (device as any).opened,
    };
    return info;
  }

  private handleDisconnect(): void {
    this.currentDeviceInfo = null;
    if (this.currentTransport) {
      try {
        this.currentTransport.close();
      } catch {}
    }
    this.currentTransport = null;
    this.emit("disconnected", null);
  }

  async isSupported(): Promise<boolean> {
    try {
      this.ensureInit();
      const hasHid = typeof window !== "undefined" && !!(navigator as any).hid;
      const hasUsb = typeof window !== "undefined" && !!(navigator as any).usb;
      return Boolean(hasHid || hasUsb);
    } catch {
      return false;
    }
  }

  async requestDevice(): Promise<LedgerDeviceInfo> {
    this.ensureInit();
    // Prefer WebHID
    const hasHid = typeof window !== "undefined" && !!(navigator as any).hid;
    const hasUsb = typeof window !== "undefined" && !!(navigator as any).usb;
    if (!hasHid && !hasUsb) {
      throw new Error("Ledger over WebHID/WebUSB not supported by this browser. Try Chrome.");
    }

    try {
      if (hasHid) {
        // If SDK exposes request, use it to force chooser, else fallback to navigator.hid
        try {
          const anyHid: any = TransportWebHID as any;
          if (typeof anyHid.request === "function") {
            await anyHid.request();
          } else if ((navigator as any).hid && typeof (navigator as any).hid.requestDevice === "function") {
            // Ledger vendorId 0x2c97
            await (navigator as any).hid.requestDevice({ filters: [{ vendorId: 0x2c97 }] });
          }
        } catch (e: any) {
          if (e && e.name === "NotFoundError") {
            throw new Error("No Ledger device selected.");
          }
          throw e;
        }
        const transport = await TransportWebHID.create();
        this.currentTransport = transport as any;
        const device = (transport as any).device as HIDDevice;
        const info = this.setDeviceFromHidDevice(device);
        this.currentDeviceInfo = info;
        this.emit("connected", info);
        return info;
      }
    } catch (err: any) {
      // HID failed, fallback to USB
      if (!hasUsb) {
        throw this.friendlyError(err);
      }
      try {
        const anyUsb: any = TransportWebUSB as any;
        if (typeof anyUsb.request === "function") {
          await anyUsb.request();
        } else if ((navigator as any).usb && typeof (navigator as any).usb.requestDevice === "function") {
          await (navigator as any).usb.requestDevice({ filters: [{ vendorId: 0x2c97 }] });
        }
        const transport = await TransportWebUSB.create();
        this.currentTransport = transport as any;
        const device = (transport as any).device as USBDevice;
        const info = this.setDeviceFromUsbDevice(device);
        this.currentDeviceInfo = info;
        this.emit("connected", info);
        return info;
      } catch (usbErr: any) {
        throw this.friendlyError(usbErr);
      }
    }

    // If we reached here without returning and HID was not present, try USB path directly
    if (hasUsb) {
      try {
        const anyUsb: any = TransportWebUSB as any;
        if (typeof anyUsb.request === "function") {
          await anyUsb.request();
        }
        const transport = await TransportWebUSB.create();
        this.currentTransport = transport as any;
        const device = (transport as any).device as USBDevice;
        const info = this.setDeviceFromUsbDevice(device);
        this.currentDeviceInfo = info;
        this.emit("connected", info);
        return info;
      } catch (e: any) {
        throw this.friendlyError(e);
      }
    }

    throw new Error("No supported transport available.");
  }

  async open(_deviceId?: string): Promise<LedgerDeviceInfo> {
    // We assume requestDevice already selected the device and possibly opened the transport.
    // If there is already an open transport, return the info.
    this.ensureInit();
    if (this.currentTransport && this.currentDeviceInfo) {
      return this.currentDeviceInfo;
    }
    // If none, try to create via preferred HID then USB.
    try {
      const transport = await TransportWebHID.create();
      this.currentTransport = transport as any;
      const device = (transport as any).device as HIDDevice;
      const info = this.setDeviceFromHidDevice(device);
      this.currentDeviceInfo = info;
      this.emit("connected", info);
      return info;
    } catch (hidErr: any) {
      try {
        const transport = await TransportWebUSB.create();
        this.currentTransport = transport as any;
        const device = (transport as any).device as USBDevice;
        const info = this.setDeviceFromUsbDevice(device);
        this.currentDeviceInfo = info;
        this.emit("connected", info);
        return info;
      } catch (usbErr: any) {
        throw this.friendlyError(usbErr || hidErr);
      }
    }
  }

  async close(): Promise<void> {
    try {
      if (this.currentTransport) {
        await this.currentTransport.close();
      }
    } catch {}
    this.handleDisconnect();
  }

  on(event: EventName, cb: Listener): () => void {
    this.ensureInit();
    this.listeners[event].add(cb);
    return () => {
      this.listeners[event].delete(cb);
    };
  }

  getCurrentDevice(): LedgerDeviceInfo | null {
    return this.currentDeviceInfo;
  }

  private ensureTransport(): TransportWebHID | TransportWebUSB {
    if (!this.currentTransport) {
      throw new Error("No Ledger transport open. Call connect first.");
    }
    return this.currentTransport;
  }

  private getEth(): AppEth {
    const transport = this.ensureTransport() as any;
    return new AppEth(transport);
  }

  private async ensureEthereumAppOpen(): Promise<void> {
    try {
      const transport: any = this.ensureTransport();
      if (!transport || typeof transport.send !== "function") return;
      // Open app APDU for "Ethereum"
      const encoder = new TextEncoder();
      const nameBytes = encoder.encode("Ethereum");
      const data = Uint8Array.from(nameBytes);
      await transport.send(0xe0, 0xd8, 0x00, 0x00, data);
      await new Promise((r) => setTimeout(r, 250));
    } catch (e: any) {
      // ignore if already open
    }
  }

  async getAttestedPublicKey(): Promise<string> {
    // For demo purposes, derive from a standard path
    // Using Ethereum app to retrieve the uncompressed public key
    const eth = this.getEth();
    const PATH = "44'/60'/0'/0/0";
    // Ensure Ethereum app is open
    await this.ensureEthereumAppOpen();
    // showOnDevice true gives a clear UX prompt
    const res = await eth.getAddress(PATH, true, false);
    // Ledger returns uncompressed public key without 0x prefix (65 bytes, 0x04...)
    const pk = res.publicKey.startsWith("0x") ? res.publicKey : `0x${res.publicKey}`;
    return pk.toLowerCase();
  }

  async signNonce(nonceHex: string): Promise<string> {
    // Prefer personal_sign on a human-readable message; some firmwares reject raw bytes
    const eth = this.getEth();
    const PATH = "44'/60'/0'/0/0";
    const message = formatAttestationMessage(nonceHex);
    // Encode string to hex without Node Buffer
    const encoder = new TextEncoder();
    const bytes = encoder.encode(message);
    const msgHex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    // Ensure Ethereum app is open
    await this.ensureEthereumAppOpen();
    const sig = await eth.signPersonalMessage(PATH, msgHex);
    // Compose 65-byte signature 0x{r}{s}{v}
    let vNum: number;
    if (typeof sig.v === "string") {
      const vStr = sig.v.trim().toLowerCase();
      vNum = vStr.startsWith("0x") ? parseInt(vStr, 16) : parseInt(vStr, 10);
    } else {
      vNum = Number(sig.v);
    }
    if (vNum === 0 || vNum === 1) vNum += 27; // normalize to 27/28
    const vHex = vNum.toString(16).padStart(2, "0");
    const signature = `0x${sig.r}${sig.s}${vHex}`.toLowerCase();
    return signature;
  }

  private friendlyError(err: any): Error {
    const message = (err && (err.message || err.name)) || String(err);
    const statusCode: string | null = (err && (err.statusCodeHex || err.statusCode))
      ? String(err.statusCodeHex || err.statusCode)
      : (() => {
          const m = /0x[0-9a-fA-F]{4}/.exec(message || "");
          return m ? m[0] : null;
        })();
    if (statusCode) {
      const code = statusCode.toLowerCase();
      if (code === "0x650e" || code === "0x6511") {
        return new Error("Ledger refused the request. Open the Ethereum app, unlock the device, and enable Blind signing if prompted.");
      }
    }
    if (/denied|NotAllowed|Permission/i.test(message)) {
      return new Error("Permission denied. Please allow device access and try again.");
    }
    if (/No device selected|No device found|NotFound/i.test(message)) {
      return new Error("No Ledger device selected.");
    }
    return new Error(message);
  }
}

export const dmkClient = new DmkClient();

export type { EventName as DmkEventName };

