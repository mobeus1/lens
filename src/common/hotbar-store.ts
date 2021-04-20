import { action, comparer, observable, toJS, makeObservable } from "mobx";
import { BaseStore } from "./base-store";
import migrations from "../migrations/hotbar-store";

export interface HotbarItem {
  entity: {
    uid: string;
  };
  params?: {
    [key: string]: string;
  }
}

export interface Hotbar {
  name: string;
  items: HotbarItem[];
}

export interface HotbarStoreModel {
  hotbars: Hotbar[];
}

export class HotbarStore extends BaseStore<HotbarStoreModel> {
  @observable hotbars: Hotbar[] = [];

  private constructor() {
    super({
      configName: "lens-hotbar-store",
      accessPropertiesByDotNotation: false, // To make dots safe in cluster context names
      syncOptions: {
        equals: comparer.structural,
      },
      migrations,
    });
    makeObservable(this);
  }

  @action protected async fromStore(data: Partial<HotbarStoreModel> = {}) {
    this.hotbars = data.hotbars || [{
      name: "default",
      items: []
    }];
  }

  getByName(name: string) {
    return this.hotbars.find((hotbar) => hotbar.name === name);
  }

  add(hotbar: Hotbar) {
    this.hotbars.push(hotbar);
  }

  remove(hotbar: Hotbar) {
    this.hotbars = this.hotbars.filter((h) => h !== hotbar);
  }

  toJSON(): HotbarStoreModel {
    return toJS({
      hotbars: this.hotbars
    });
  }
}

export const hotbarStore = HotbarStore.getInstance<HotbarStore>();