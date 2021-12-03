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
import { observer } from "mobx-react";
import { SubTitle } from "../layout/sub-title";
import { Select, SelectOption } from "../select";
import { ThemeStore } from "../../theme.store";
import { UserStore } from "../../../common/user-store";
import { Input } from "../input";
import { isWindows } from "../../../common/vars";
import { FormSwitch, Switcher } from "../switch";
import moment from "moment-timezone";
import { CONSTANTS, defaultExtensionRegistryUrl, ExtensionRegistryLocation } from "../../../common/user-store/preferences-helpers";
import { action } from "mobx";
import { isUrl } from "../input/input_validators";

const timezoneOptions: SelectOption<string>[] = moment.tz.names().map(zone => ({
  label: zone,
  value: zone,
}));
const updateChannelOptions: SelectOption<string>[] = Array.from(
  CONSTANTS.updateChannels.entries(),
  ([value, { label }]) => ({ value, label }),
);

export const Application = observer(() => {
  const userStore = UserStore.getInstance();
  const defaultShell = process.env.SHELL
    || process.env.PTYSHELL
    || (
      isWindows
        ? "powershell.exe"
        : "System default shell"
    );

  const [shell, setShell] = React.useState(userStore.shell || "");
  const [customUrl, setCustomUrl] = React.useState(userStore.extensionRegistryUrl.customUrl || "");

  return (
    <section id="application">
      <h2 data-testid="application-header">Application</h2>
      <section id="appearance">
        <SubTitle title="Theme"/>
        <Select
          options={ThemeStore.getInstance().themeOptions}
          value={userStore.colorTheme}
          onChange={({ value }) => userStore.colorTheme = value}
          themeName="lens"
        />
      </section>

      <hr/>

      <section id="shell">
        <SubTitle title="Terminal Shell Path"/>
        <Input
          theme="round-black"
          placeholder={defaultShell}
          value={shell}
          onChange={setShell}
          onBlur={() => userStore.shell = shell}
        />
      </section>

      <section id="terminalSelection">
        <SubTitle title="Terminal copy & paste" />
        <FormSwitch
          label="Copy on select and paste on right-click"
          control={
            <Switcher
              checked={userStore.terminalCopyOnSelect}
              onChange={v => userStore.terminalCopyOnSelect = v.target.checked}
              name="terminalCopyOnSelect"
            />
          }
        />
      </section>

      <hr/>

      <section id="extensionRegitryUrl">
        <SubTitle title="Extensions Install Registry" />
        <Select
          options={Object.values(ExtensionRegistryLocation)}
          value={userStore.extensionRegistryUrl.location}
          onChange={action(({ value }) => {
            userStore.extensionRegistryUrl.location = value;

            if (userStore.extensionRegistryUrl.location === ExtensionRegistryLocation.CUSTOM) {
              userStore.extensionRegistryUrl.customUrl = "";
            }
          })}
          themeName="lens"
        />
        <small className="hint">
          This setting is to change the registry URL for installing extensions by name.{" "}
          If you are unable to access the default registry ({defaultExtensionRegistryUrl}) {" "}
          then you should change this setting to either the regitry in you <code>.npmrc</code> {" "}
          file or a custom one here.
        </small>
        {
          userStore.extensionRegistryUrl.location === ExtensionRegistryLocation.CUSTOM && (
            <Input
              theme="round-black"
              validators={isUrl}
              value={customUrl}
              onChange={setCustomUrl}
              onBlur={() => userStore.extensionRegistryUrl.customUrl = customUrl}
              placeholder="Custom Extension Registry URL..."
            />
          )
        }
      </section>

      <hr/>

      <section id="other">
        <SubTitle title="Start-up"/>
        <FormSwitch
          control={
            <Switcher
              checked={userStore.openAtLogin}
              onChange={v => userStore.openAtLogin = v.target.checked}
              name="startup"
            />
          }
          label="Automatically start Lens on login"
        />
      </section>

      <hr />

      <section id="update-channel">
        <SubTitle title="Update Channel"/>
        <Select
          options={updateChannelOptions}
          value={userStore.updateChannel}
          onChange={({ value }) => userStore.updateChannel = value}
          themeName="lens"
        />
      </section>

      <hr />

      <section id="locale">
        <SubTitle title="Locale Timezone" />
        <Select
          options={timezoneOptions}
          value={userStore.localeTimezone}
          onChange={({ value }) => userStore.setLocaleTimezone(value)}
          themeName="lens"
        />
      </section>
    </section>
  );
});
