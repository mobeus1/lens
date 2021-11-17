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

import "./log-resource-selector.scss";

import React from "react";
import { observer } from "mobx-react";

import type { Pod } from "../../../common/k8s-api/endpoints";
import { Badge } from "../badge";
import { GroupSelectOption, Select, SelectOption } from "../select";
import { LogTabData, logTabStore } from "./log-tab.store";
import type { TabId } from "./dock.store";

export interface LogResourceSelectorStore {
  changeSelectedPod(tabId: TabId, newSelectedPod: Pod): void;
  mergeData(tabId: TabId, data: Partial<LogTabData>): void;
}

export interface LogResourceSelectorProps {
  tabId: TabId;
  pod: Pod;
  pods: Pod[];
  selectedContainer: string;
  store?: LogResourceSelectorStore;
}

function getSelected<T>(groups: GroupSelectOption<SelectOption<T>>[], value: T): SelectOption<T> | undefined {
  for (const group of groups) {
    for (const option of group.options) {
      if (option.value === value) {
        return option;
      }
    }
  }

  return undefined;
}

export const LogResourceSelector = observer(({ tabId, pod, pods, selectedContainer, store = logTabStore }: LogResourceSelectorProps) => {
  const containers = pod.getContainers();
  const initContainers = pod.getInitContainers();

  const containerSelectOptions: GroupSelectOption<SelectOption<string>>[] = [
    {
      label: `Containers`,
      options: containers.map(container => ({
        value: container.name,
        label: container.name,
      })),
    },
    {
      label: `Init Containers`,
      options: initContainers.map(container => ({
        value: container.name,
        label: container.name,
      })),
    },
  ];

  const podSelectOptions: GroupSelectOption<SelectOption<Pod>>[] = [{
    label: pod.getOwnerRefs()[0].name,
    options: pods.map(pod => ({
      label: pod.getName(),
      value: pod,
    })),
  }];

  return (
    <div className="LogResourceSelector flex gaps align-center">
      <span>Namespace</span> <Badge data-testid="namespace-badge" label={pod.getNs()}/>
      <span>Pod</span>
      <Select
        options={podSelectOptions}
        value={getSelected(podSelectOptions, pod)}
        onChange={({ value }) => store.changeSelectedPod(tabId, value)}
        autoConvertOptions={false}
        className="pod-selector"
      />
      <span>Container</span>
      <Select
        options={containerSelectOptions}
        value={getSelected(containerSelectOptions, selectedContainer)}
        onChange={({ value }) => store.mergeData(tabId, { selectedContainer: value })}
        autoConvertOptions={false}
        className="container-selector"
      />
    </div>
  );
});
