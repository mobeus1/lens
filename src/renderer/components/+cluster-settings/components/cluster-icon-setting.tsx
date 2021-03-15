import React from "react";
import { Cluster } from "../../../../main/cluster";
import { FilePicker, OverSizeLimitStyle } from "../../file-picker";
import { autobind } from "../../../utils";
import { Button } from "../../button";
import { observable, reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import { SubTitle } from "../../layout/sub-title";
import { ClusterIcon } from "../../cluster-icon";
import { Input } from "../../input";
import { throttle } from "lodash";

enum GeneralInputStatus {
  CLEAN = "clean",
  ERROR = "error",
}

interface Props {
  cluster: Cluster;
}

@observer
export class ClusterIconSetting extends React.Component<Props> {
  @observable status = GeneralInputStatus.CLEAN;
  @observable errorText?: string;
  @observable iconColour = this.getIconBackgroundColorValue();

  componentDidMount() {
    disposeOnUnmount(this, [
      reaction(() => this.iconColour, background => {
        // This is done so that the UI can update as fast as it would like
        // without the necessary slowing down of the updates to the Cluster
        // Preferences (to prevent too many file writes).
        this.onColorChange(background);
      }),
    ]);
  }

  @autobind()
  async onIconPick([file]: File[]) {
    const { cluster } = this.props;

    try {
      if (file) {
        const buf = Buffer.from(await file.arrayBuffer());

        cluster.preferences.icon = `data:${file.type};base64,${buf.toString("base64")}`;
      } else {
        // this has to be done as a seperate branch (and not always) because `cluster`
        // is observable and triggers an update loop.
        cluster.preferences.icon = undefined;
      }
    } catch (e) {
      this.errorText = e.toString();
      this.status = GeneralInputStatus.ERROR;
    }
  }

  getClearButton() {
    if (this.props.cluster.preferences.icon) {
      return <Button tooltip="Revert back to default icon" accent onClick={() => this.onIconPick([])}>Clear</Button>;
    }
  }

  getIconBackgroundColorValue(): string {
    const { iconPreference } = this.props.cluster;

    if (typeof iconPreference === "string") {
      return getComputedStyle(document.documentElement).getPropertyValue("--halfGray").trim().slice(0, 7);
    }

    return iconPreference.background;
  }

  onColorChange = throttle(background => {
    this.props.cluster.preferences.icon = { background };
  }, 200, {
    leading: true,
    trailing: true,
  });

  render() {
    const label = (
      <>
        <ClusterIcon
          cluster={this.props.cluster}
          showErrors={false}
          showTooltip={false}
        />
        Browse for new icon...
      </>
    );

    return (
      <>
        <SubTitle title="Cluster Icon" />
        <p>Define cluster icon. By default automatically generated.</p>
        <div className="file-loader">
          <FilePicker
            accept="image/*"
            label={label}
            onOverSizeLimit={OverSizeLimitStyle.FILTER}
            handler={this.onIconPick}
          />
          {this.getClearButton()}
        </div>
        <p>Or change the colour of the generated icon.</p>
        <div>
          <Input
            className="icon-background-color"
            type="color"
            value={this.iconColour}
            title="Choose auto generated icon's background color"
            onChange={background => this.iconColour = background}
          />
          <small className="hint">
            This action clears any previously set icon.
          </small>
        </div>
      </>
    );
  }
}
