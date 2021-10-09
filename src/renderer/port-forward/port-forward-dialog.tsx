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

import "./port-forward-dialog.scss";

import React, { Component } from "react";
import { observable, makeObservable } from "mobx";
import { observer } from "mobx-react";
import { Dialog, DialogProps } from "../components/dialog";
import { Wizard, WizardStep } from "../components/wizard";
import { Input } from "../components/input";
import { Notifications } from "../components/notifications";
import { cssNames } from "../utils";
import { addPortForward, modifyPortForward, openPortForward } from "./port-forward.store";
import type { ForwardedPort } from "./port-forward-item";

interface Props extends Partial<DialogProps> {
}

interface PortForwardDialogOpenOptions {
  openInBrowser: boolean
}

const dialogState = observable.object({
  isOpen: false,
  data: null as ForwardedPort,
  openInBrowser: false
});

@observer
export class PortForwardDialog extends Component<Props> {
  @observable ready = false;
  @observable currentPort = 0;
  @observable desiredPort = 0;

  constructor(props: Props) {
    super(props);
    makeObservable(this);
  }

  static open(portForward: ForwardedPort, options : PortForwardDialogOpenOptions = { openInBrowser:  false }) {
    dialogState.isOpen = true;
    dialogState.data = portForward;
    dialogState.openInBrowser = options.openInBrowser;
  }

  static close() {
    dialogState.isOpen = false;
  }

  get portForward() {
    return dialogState.data;
  }

  close = () => {
    PortForwardDialog.close();
  };

  onOpen = async () => {
    const { portForward } = this;

    this.currentPort = +portForward.forwardPort;
    this.desiredPort = this.currentPort;
    this.ready = this.currentPort ? false : true;
  };

  onClose = () => {
    this.ready = false;
  };

  changePort = (value: string) => {
    this.desiredPort = Number(value);
    this.ready = Boolean(this.desiredPort == 0 || this.currentPort !== this.desiredPort);
  };

  startPortForward = async () => {
    const { portForward } = this;
    const { currentPort, desiredPort, close } = this;

    try {
      let port: number;

      if (currentPort) {
        port = await modifyPortForward(portForward, desiredPort);
      } else {
        portForward.forwardPort = desiredPort;
        port = await addPortForward(portForward);
      }
      
      if (dialogState.openInBrowser) {
        portForward.forwardPort = port;
        openPortForward(portForward);
      }
    } catch (err) {
      Notifications.error(err);
    } finally {
      close();
    }
  };

  renderContents() {
    return (
      <>
        <div className="flex gaps align-center">
          <div className="input-container flex align-center">
            <div className="current-port" data-testid="current-port">
              Local port to forward from:
            </div>
            <Input className="portInput"
              type="number"
              min="0"
              max="65535"
              value={this.desiredPort === 0 ? "" : String(this.desiredPort)}
              placeholder={"Random"}
              onChange={this.changePort}
            />
          </div>
        </div>
      </>
    );
  }

  render() {
    const { className, ...dialogProps } = this.props;
    const resourceName = this.portForward?.name ?? "";
    const header = (
      <h5>
        Port Forwarding for <span>{resourceName}</span>
      </h5>
    );

    return (
      <Dialog
        {...dialogProps}
        isOpen={dialogState.isOpen}
        className={cssNames("PortForwardDialog", className)}
        onOpen={this.onOpen}
        onClose={this.onClose}
        close={this.close}
      >
        <Wizard header={header} done={this.close}>
          <WizardStep
            contentClass="flex gaps column"
            next={this.startPortForward}
            nextLabel={this.currentPort === 0 ? "Start" : "Restart"}
            disabledNext={!this.ready}
          >
            {this.renderContents()}
          </WizardStep>
        </Wizard>
      </Dialog>
    );
  }
}
