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


import { Select } from "../select";
import { computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { CommandRegistry } from "../../../extensions/registries/command-registry";
import { CommandOverlay } from "./command-overlay";
import { catalogEntityRegistry } from "../../api/catalog-entity-registry";
import type { CatalogEntity } from "../../../common/catalog";
import { navigate } from "../../navigation";
import { broadcastMessage } from "../../../common/ipc";
import { IpcRendererNavigationEvents } from "../../navigation/events";

@observer
export class CommandDialog extends React.Component {
  @observable searchValue: any = undefined;

  constructor(props: {}) {
    super(props);
    makeObservable(this);
  }

  @computed get activeEntity(): CatalogEntity | undefined {
    return catalogEntityRegistry.activeEntity;
  }

  @computed get options() {
    const registry = CommandRegistry.getInstance();

    const context = {
      entity: this.activeEntity,
    };

    return registry.getItems().filter((command) => {
      try {
        return command.isActive(context);
      } catch(error) {
        console.error(`[COMMAND-DIALOG]: isActive for ${command.id} threw an error, defaulting to false`, error);
      }

      return false;
    })
      .map(({ id, title }) => ({
        value: id,
        label: typeof title === "function"
          ? title(context)
          : title,
      }))
      .sort((a, b) => a.label > b.label ? 1 : -1);
  }

  private async executeAction(commandId: string) {
    const command = CommandRegistry.getInstance().getById(commandId);

    if (!command) {
      return;
    }

    try {
      CommandOverlay.close();
      command.action({
        entity: this.activeEntity,
        navigate: (url, opts = {}) => {
          const { forceRootFrame = false } = opts;

          if (forceRootFrame) {
            broadcastMessage(IpcRendererNavigationEvents.NAVIGATE_IN_APP, url);
          } else {
            navigate(url);
          }
        },
      });
    } catch(error) {
      console.error("[COMMAND-DIALOG] failed to execute command", command.id, error);
    }
  }

  render() {
    return (
      <Select
        menuPortalTarget={null}
        onChange={v => this.executeAction(v.value)}
        components={{
          DropdownIndicator: null,
          IndicatorSeparator: null,
        }}
        menuIsOpen
        options={this.options}
        autoFocus={true}
        escapeClearsValue={false}
        data-test-id="command-palette-search"
        placeholder="Type a command or search&hellip;"
        onInputChange={(newValue, { action }) => {
          if (action === "input-change") {
            this.searchValue = newValue;
          }
        }}
        inputValue={this.searchValue}
      />
    );
  }
}
