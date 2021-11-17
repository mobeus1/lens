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
import { observable, reaction, makeObservable, comparer } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";

import { searchStore } from "../../../common/search-store";
import type { DockTab } from "./dock.store";
import { InfoPanel } from "./info-panel";
import { LogResourceSelector } from "./log-resource-selector";
import { LogList } from "./log-list";
import { logStore } from "./log.store";
import { LogSearch } from "./log-search";
import { LogControls } from "./log-controls";
import { logTabStore } from "./log-tab.store";
import { podsStore } from "../+workloads-pods/pods.store";

interface Props {
  className?: string
  tab: DockTab
}

@observer
export class Logs extends React.Component<Props> {
  @observable isLoading = true;

  private logListElement = React.createRef<LogList>(); // A reference for VirtualList component

  constructor(props: Props) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    this.load();

    disposeOnUnmount(this,
      reaction(
        () => [this.tabId, logTabStore.getData(this.tabId)] as const,
        ([curTabId], [oldTabId]) => {
          if (curTabId !== oldTabId) {
            logStore.clearLogs(this.tabId);
          }

          this.load();
        },
        {
          equals: comparer.structural,
        },
      ),
    );
  }

  get tabId() {
    return this.props.tab.id;
  }

  load = async () => {
    this.isLoading = true;
    await logStore.load(this.tabId);
    this.isLoading = false;
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
      const overlay = document.querySelector(".PodLogs .list span.active");

      if (!overlay) return;
      overlay.scrollIntoViewIfNeeded();
    }, 100);
  };

  render() {
    const { logs, logsWithoutTimestamps } = logStore;
    const data = logTabStore.getData(this.tabId);

    if (!data) {
      return null;
    }

    const { podsOwner, selectedContainer, selectedPod, showTimestamps, previous } = data;
    const searchLogs = showTimestamps ? logs : logsWithoutTimestamps;
    const pods = podsStore.getPodsByOwnerId(podsOwner);
    const pod = pods.find(pod => pod.getId() === selectedPod);

    if (!pod) {
      return (
        <div className="PodLogs flex column">
          <p>Pod with ID {selectedPod} is no longer found under owner {podsOwner}</p>
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
              <LogSearch
                onSearch={this.onSearch}
                logs={searchLogs}
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
          id={this.tabId}
          isLoading={this.isLoading}
          load={this.load}
          ref={this.logListElement}
        />
        <LogControls
          tabId={this.tabId}
          pod={pod}
          preferences={{ previous, showTimestamps }}
        />
      </div>
    );
  }
}
