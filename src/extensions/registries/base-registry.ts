/**
 * Copyright (c) 2021 OpenLens Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// Base class for extensions-api registries
import { action, observable, makeObservable } from "mobx";
import { Disposer, Singleton } from "../../common/utils";
import { LensExtension } from "../lens-extension";

export interface BaseRegistryOptions<T, I, ItemId> {
  /**
   * The function to get the registered version (and Id) of an item
   */
  getRegisteredItem: (item: T, extension?: LensExtension) => [ItemId, I];
}

export class BaseRegistry<T, I = T, ItemId = T> extends Singleton {
  private items = observable.map<ItemId, I>([], { deep: false });
  private getRegisteredItem: (item: T, extension?: LensExtension) => [ItemId, I];

  constructor(opts: BaseRegistryOptions<T, I, ItemId>) {
    super();
    makeObservable(this);

    this.getRegisteredItem = opts.getRegisteredItem;
  }

  getItems(): I[] {
    return Array.from(this.items.values());
  }

  getById(id: ItemId): I | undefined {
    return this.items.get(id);
  }

  @action
  add(items: T[], extension?: LensExtension): Disposer {
    const registeredItems = items.map(item => this.getRegisteredItem(item, extension));
    const newIds: ItemId[] = [];

    for (const [id, item] of registeredItems) {
      if (!this.items.has(id)) {
        this.items.set(id, item);
        newIds.push(id);
      }
    }

    return action(() => {
      for (const id of newIds) {
        this.items.delete(id);
      }
    });
  }
}
