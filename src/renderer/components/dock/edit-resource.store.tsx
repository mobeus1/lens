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

import React from "react";
import { autoBind } from "../../utils";
import { DockTabStore } from "./dock-tab.store";
import { autorun, IReactionDisposer, observable, reaction, runInAction } from "mobx";
import { dockStore, DockTab, DockTabCreateSpecific, TabId, TabKind } from "./dock.store";
import type { KubeObject, RawKubeObject } from "../../../common/k8s-api/kube-object";
import yaml from "js-yaml";
import { parseKubeApi, createKubeApiURL } from "../../../common/k8s-api/kube-api-parse";
import { apiKube } from "../../api";
import logger from "../../../common/logger";
import { createPatch } from "rfc6902";
import { patchTypeHeaders } from "../../../common/k8s-api/kube-api";

/**
 * The label name that Lens uses to receive the desired api version
 */
export const EditResourceLabelName = "k8slens-edit-resource-version";

export interface EditingResource {
  resource: string; // resource path, e.g. /api/v1/namespaces/default
  draft?: string; // edited draft in yaml
  firstDraft?: string;
}

export class EditResourceStore extends DockTabStore<EditingResource> {
  private watchers = new Map<TabId, IReactionDisposer>();

  /**
   * A map of initial resources for the tabs, this is necessary so that the
   * apiVersions can be different then that of the stores
   */
  private resources = observable.map<TabId, RawKubeObject>();

  constructor() {
    super({
      storageKey: "edit_resource_store",
    });
    autoBind(this);
  }

  protected init() {
    super.init();

    this.storage.whenReady
      .then(() => {
        autorun(() => {
          const seenTabs = new Set<string>();

          for (const [tabId, tabData] of this.data) {
            seenTabs.add(tabId);

            if (this.watchers.has(tabId)) {
              continue;
            }

            let ac = new AbortController();

            this.watchers.set(tabId, reaction(() => tabData.resource, async resource => {
              ac.abort();
              ac = new AbortController();

              try {
                const data: RawKubeObject = await apiKube.get(resource, undefined, { signal: ac.signal });

                data.metadata.selfLink = resource;

                runInAction(() => {
                  this.resources.set(tabId, data);
                  tabData.firstDraft = yaml.dump(data, { skipInvalid: true });
                });
              } catch (error) {
                if (error instanceof DOMException) {
                  return;
                }

                logger.warn(`[EDIT-RESOURCE-STORE]: could not find kubeobject with selflink=${resource}`, error);
                dockStore.closeTab(tabId);
              }
            }, {
              fireImmediately: true,
            }));
          }

          // Stop watching closed tabs
          for (const [currentWatch, dispose] of this.watchers) {
            if (!seenTabs.has(currentWatch)) {
              dispose();
              this.watchers.delete(currentWatch);
            }
          }
        });
      });
  }

  protected finalizeDataForSave({ draft, ...data }: EditingResource): EditingResource {
    return data; // skip saving draft to local-storage
  }

  isReady(tabId: TabId): boolean {
    return super.isReady(tabId) && this.resources.has(tabId);
  }

  isClean(tabId: TabId): boolean {
    const data = this.getData(tabId);

    if (data?.draft) {
      return data.firstDraft === data.draft;
    }

    return true;
  }

  /**
   * Calculates the diff between the initial version and the current saved
   * version and then patches the kube resource. Updating the tab with the
   * new data
   * @param tabId The ID of the tab to commit the changes for
   * @returns A success message
   */
  async commitEdits(tabId: TabId): Promise<React.ReactNode> {
    const tabData = this.getData(tabId);

    if (!tabData?.draft || !tabData?.firstDraft) {
      return null;
    }

    const { draft, firstDraft, resource } = tabData;

    const currentVersion = yaml.load(draft) as RawKubeObject;

    // Make sure we save this label so that we can use it in the future
    currentVersion.metadata.labels ??= {};
    currentVersion.metadata.labels[EditResourceLabelName] = currentVersion.apiVersion.split("/").pop();

    const selflink = getEditSelfLinkFor(currentVersion);
    const initialVersion = yaml.load(firstDraft) as RawKubeObject;
    const patches = createPatch(initialVersion, currentVersion);

    const { kind, metadata: { name }} = await apiKube.patch(resource, { data: patches }, {
      headers: {
        "content-type": patchTypeHeaders.json,
      },
    });

    runInAction(() => {
      tabData.draft = undefined;
      tabData.firstDraft = undefined;
      tabData.resource = selflink;
      this.resources.delete(tabId);
    });

    return <p>{kind} <b>{name}</b> updated.</p>;
  }

  getResource(tabId: TabId): RawKubeObject | undefined {
    return this.resources.get(tabId);
  }

  getTabBySelflink(selfLink: string): DockTab | undefined {
    for (const [tabId, tabData] of this.data) {
      if (tabData.resource === selfLink) {
        return dockStore.getTabById(tabId);
      }
    }

    return undefined;
  }

  reset() {
    super.reset();
    Array.from(this.watchers).forEach(([tabId, dispose]) => {
      this.watchers.delete(tabId);
      dispose();
    });
  }
}

export const editResourceStore = new EditResourceStore();

function getEditSelfLinkFor(object: RawKubeObject): string {
  if (object.metadata.labels?.[EditResourceLabelName]) {
    const { apiVersionWithGroup, ...parsedApi } = parseKubeApi(object.metadata.selfLink);

    parsedApi.apiVersion = object.metadata.labels?.[EditResourceLabelName];

    return createKubeApiURL({
      ...parsedApi,
      apiVersion: `${parsedApi.apiGroup}/${parsedApi.apiVersion}`,
    });
  }

  return object.metadata.selfLink;
}

export function editResourceTab(object: KubeObject, tabParams: DockTabCreateSpecific = {}) {
  const editSelfLink = getEditSelfLinkFor(object);

  // use existing tab if already opened
  const existingTab = editResourceStore.getTabBySelflink(editSelfLink);

  if (existingTab) {
    dockStore.open();
    dockStore.selectTab(existingTab.id);

    return existingTab;
  }

  const newTab = dockStore.createTab({
    title: `${object.kind}: ${object.getName()}`,
    ...tabParams,
    kind: TabKind.EDIT_RESOURCE,
  }, false);

  editResourceStore.setData(newTab.id, {
    resource: editSelfLink,
  });

  return newTab;
}
