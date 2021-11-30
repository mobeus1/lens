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
import { observable, makeObservable, comparer, computed, when } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";

import { searchStore } from "../../../common/search-store";
import type { DockTab } from "./dock.store";
import { InfoPanel } from "./info-panel";
import { LogResourceSelector } from "./log-resource-selector";
import { LogList } from "./log-list";
import { logStore } from "./log.store";
import { LogSearch } from "./log-search";
import { LogControls } from "./log-controls";
import { LogTabData, logTabStore } from "./log-tab.store";
import { podsStore } from "../+workloads-pods/pods.store";
import { kubeWatchApi } from "../../../common/k8s-api/kube-watch-api";
import { Spinner } from "../spinner";
import { disposingReaction, noop } from "../../utils";

interface Props {
  className?: string
  tab: DockTab
}

@observer
export class Logs extends React.Component<Props> {
  @observable isLoading = true;
  /**
   * Only used for the inital loading of logs so that when logs are shorter
   * than the viewport the user doesn't get incessant spinner every 700ms
   */
  @observable isLoadingInital = true;

  private logListElement = React.createRef<LogList>(); // A reference for VirtualList component

  constructor(props: Props) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    disposeOnUnmount(this, [
      kubeWatchApi.subscribeStores([
        podsStore,
      ], {
        namespaces: logTabStore.getNamespaces(),
      }),
      when(() => this.canLoad, () => this.load(true)),
      disposingReaction(
        () => [this.tabId, this.tabData] as const,
        ([curTabId], [oldTabId]) => {
          if (curTabId !== oldTabId) {
            logStore.clearLogs(this.tabId);
          }

          return when(() => this.canLoad, () => this.load(true));
        },
        {
          equals: comparer.structural,
        },
      ),
      disposingReaction(() => this.tabData, (data) => {
        if (data) {
          return noop;
        }

        return when(() => this.canSwap, () => {
          const { pods, pod } = this.getPods(data);

          if (pods && !pod && pods.length > 0) {
            logTabStore.mergeData(this.tabId, { selectedPod: pods[0].getId() });
          }
        });
      }, {
        equals: comparer.structural,
        fireImmediately: false,
      }),
    ]);
  }

  private getPods({ podsOwner, selectedPod }: LogTabData) {
    if (podsOwner) {
      const pods = podsStore.getPodsByOwnerId(podsOwner);
      const pod = pods.find(pod => pod.getId() === selectedPod);

      return { pods, pod };
    }

    return { pod: podsStore.getById(selectedPod) };
  }

  @computed get tabData(): LogTabData {
    return logTabStore.getData(this.tabId);
  }

  @computed get tabId() {
    return this.props.tab.id;
  }

  @computed get canSwap(): boolean {
    const data = this.tabData;

    if (!data) {
      return false;
    }

    const { podsOwner } = data;

    if (!podsOwner) {
      return false;
    }

    return podsStore.getPodsByOwnerId(podsOwner).length > 0;
  }

  @computed get canLoad(): boolean {
    const data = this.tabData;

    if (!data) {
      return false;
    }

    const { podsOwner, selectedPod } = data;
    const pod = podsOwner
      ? podsStore.getPodsByOwnerId(podsOwner).find(pod => pod.getId() === selectedPod)
      : podsStore.getById(selectedPod);

    return Boolean(pod);
  }

  load = async (initial = false) => {
    this.isLoading = true;
    this.isLoadingInital = initial;
    await logStore.load(this.tabId, this.tabData);
    this.isLoading = false;
    this.isLoadingInital = false;
  };

  /**
   * Scrolling to active overlay (search word highlight)
   */
  onSearch = () => {
    const { activeOverlayLine } = searchStore;

    if (!this.logListElement.current || activeOverlayLine === undefined) return;
    // Scroll vertically
    this.logListElement.current.scrollToItem(activeOverlayLine, "center");
    // Scroll horizontally in timeout since virtual list need some time to prepare its contents
    setTimeout(() => {
      document.querySelector(".PodLogs .list span.active")?.scrollIntoViewIfNeeded();
    }, 100);
  };

  render() {
    const data = this.tabData;

    if (!data) {
      return null;
    }

    const logs = logStore.getLogs(this.tabId, data);
    const { podsOwner, selectedContainer, selectedPod, showTimestamps, previous } = data;
    const { pods, pod } = this.getPods(data);

    if (!pod) {
      return (
        <div className="PodLogs flex column">
          <p>Pod with ID {selectedPod} is no longer found {podsOwner && `under owner ${podsOwner}`}</p>
        </div>
      );
    }

    return (
      <div className="PodLogs flex column">
        <InfoPanel
          tabId={this.props.tab.id}
          controls={
            <div className="flex gaps">
              <LogResourceSelector
                tabId={this.tabId}
                pod={pod}
                pods={pods}
                selectedContainer={selectedContainer}
              />
              {
                (this.isLoading && !this.isLoadingInital) && (
                  <Spinner />
                )
              }
              <LogSearch
                onSearch={this.onSearch}
                logs={logs}
                toPrevOverlay={this.onSearch}
                toNextOverlay={this.onSearch}
              />
            </div>
          }
          showSubmitClose={false}
          showButtons={false}
          showStatusPanel={false}
        />
        <LogList
          logs={logs}
          selectedContainer={selectedContainer}
          isLoading={this.isLoadingInital}
          load={this.load}
          ref={this.logListElement}
        />
        <LogControls
          tabId={this.tabId}
          pod={pod}
          preferences={{ previous, showTimestamps }}
          logs={logs}
        />
      </div>
    );
  }
}
