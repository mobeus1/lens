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

import Joi from "joi";
import uniqueId from "lodash/uniqueId";
import { action } from "mobx";
import type { IPodContainer, Pod } from "../../../common/k8s-api/endpoints";
import logger from "../../../common/logger";
import { DockTabStore } from "./dock-tab.store";
import { dockStore, TabKind } from "./dock.store";

export interface LogTabData {
  /**
   * The pod owner ID
   */
  podsOwner: string;

  /**
   * The ID of the pod from the list of pods owned by `.podsOwner`
   */
  selectedPod: string;

  /**
   * The name of the container within the selected pod.
   *
   * Note: container names are guaranteed unique
   */
  selectedContainer?: string;

  /**
   * Whether to show timestamps inline with the logs
   */
  showTimestamps: boolean;

  /**
   * Query for getting logs of the previous container restart
   */
  previous: boolean;
}

const logTabDataValidator = Joi.object({
  podsOwner: Joi
    .string()
    .required(),
  selectedPod: Joi
    .string()
    .required(),
  selectedContainer: Joi
    .string()
    .optional(),
  showTimestamps: Joi
    .boolean()
    .required(),
  previous: Joi
    .boolean()
    .required(),
});

/**
 * Data for creating a pod logs tab based on a specific pod
 */
export interface PodLogsTabData {
  selectedPod: Pod
  selectedContainer: IPodContainer
}

export class LogTabStore extends DockTabStore<LogTabData> {
  constructor() {
    super({
      storageKey: "pod_logs",
    });
  }

  createPodTab(tabData: PodLogsTabData): string {
    if (!tabData || typeof tabData !== "object") {
      throw new TypeError("createPodTab provided non-object tabData");
    }

    const { selectedPod, selectedContainer } = tabData;

    if (!selectedPod || typeof selectedPod !== "object") {
      throw new TypeError("selectedPod is not defined");
    }

    if (!selectedContainer || typeof selectedContainer !== "object") {
      throw new TypeError("selectedContainer is not defined");

    }

    const podOwner = selectedPod.getOwnerRefs()[0];

    if (!podOwner) {
      throw new Error(`Pod ${selectedPod.getId()} does not have any owner refs`);
    }

    return this.createLogsTab(`Pod ${selectedPod.getName()}`, {
      podsOwner: podOwner.uid,
      selectedPod: selectedPod.getId(),
      selectedContainer: selectedContainer.name,
      showTimestamps: false,
      previous: false,
    });
  }

  @action
  changeSelectedPod(tabId: string, pod: Pod): void {
    const oldSelectedPod = this.getData(tabId).selectedPod;

    if (pod.getId() === oldSelectedPod) {
      // Do nothing
      return;
    }

    this.mergeData(tabId, { selectedPod: pod.getId(), selectedContainer: pod.getContainers()[0]?.name });
    dockStore.renameTab(tabId, `Pod ${pod.getName()}`);
  }

  private createLogsTab(title: string, data: LogTabData): string {
    const id = uniqueId("log-tab-");

    dockStore.createTab({
      id,
      title,
      kind: TabKind.POD_LOGS,
    }, false);
    this.setData(id, data);

    return id;
  }

  /**
   * Gets the data for `tabId` and validates that is is type correct, returning
   * `undefined` if incorrect.
   * @param tabId The tab to get data for
   */
  public getData(tabId: string): LogTabData | undefined {
    if (!this.data.has(tabId)) {
      return undefined;
    }

    const { value, error } = logTabDataValidator.validate(super.getData(tabId));

    if (error) {
      logger.warn(`[LOG-TAB-STORE]: data for ${tabId} was invalid`, error);
      this.closeTab(tabId);

      return undefined;
    }

    return value;
  }

  public closeTab(tabId: string) {
    this.clearData(tabId);
    dockStore.closeTab(tabId);
  }
}

export const logTabStore = new LogTabStore();
