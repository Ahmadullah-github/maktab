// src/stores/useRoomStore.ts
import { create } from "zustand";
import { Room } from "../types";
import { dataService } from "../lib/dataService";

// Define the store state and actions
interface RoomStore {
  rooms: Room[];
  isLoading: boolean;
  error: string | null;
  fetchRooms: () => Promise<void>;
  addRoom: (room: Omit<Room, "id">) => Promise<Room | null>;
  updateRoom: (room: Room) => Promise<Room | null>;
  deleteRoom: (id: string) => Promise<boolean>;
}

// Create the Zustand store
export const useRoomStore = create<RoomStore>((set, get) => ({
  rooms: [],
  isLoading: false,
  error: null,

  fetchRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      const rooms = await dataService.getRooms();
      const normalized = (rooms || []).map((r: any) => ({
        ...r,
        id: String(r.id),
      }));
      set({ rooms: normalized, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addRoom: async (roomData) => {
    try {
      const newRoom = await dataService.saveRoom(roomData);
      if (newRoom) {
        const normalized = { ...newRoom, id: String((newRoom as any).id) };
        set((state) => ({ rooms: [...state.rooms, normalized] }));
        return normalized;
      }
      return null;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  updateRoom: async (room) => {
    try {
      const updatedRoom = await dataService.saveRoom(room);
      if (updatedRoom) {
        const normalized = {
          ...updatedRoom,
          id: String((updatedRoom as any).id),
        };
        set((state) => ({
          rooms: state.rooms.map((r) =>
            String(r.id) === String(normalized.id) ? normalized : r
          ),
        }));
        return normalized;
      }
      return null;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  deleteRoom: async (id) => {
    try {
      await dataService.deleteRoom(id);
      set((state) => ({
        rooms: state.rooms.filter((room) => String(room.id) !== String(id)),
      }));
      return true;
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },
}));
