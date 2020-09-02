import React, { PureComponent } from 'react';
import _ from 'lodash';
import { css } from 'emotion';
import { Alert, Button, Icon, IconName, CustomScrollbar, Container, HorizontalGroup, ConfirmModal, Modal, InlineFormLabel } from 'src/packages/datav-core';
import { getDataSourceService, config } from 'src/packages/datav-core';
import { getAlertingValidationMessage, getDefaultCondition } from './getAlertingValidationMessage';

import EmptyListCTA from 'src/views/components/EmptyListCTA/EmptyListCTA';
import StateHistory from './StateHistory';

import { DashboardModel, PanelModel } from 'src/views/dashboard/model';
import { TestRuleResult } from './TestRuleResult';
import { AppNotificationSeverity } from 'src/types';

import { PanelEditorTabId } from '../dashboard/components/PanelEditor/types';
import { updateLocation } from 'src/store/reducers/location';
import kbn from 'src/core/library/utils/kbn';
import alertDef from './state/alertDef';
import { ThresholdMapper } from './state/ThresholdMapper';
import { Select, InputNumber } from 'antd'
const { Option } = Select

interface OwnProps {
  dashboard: DashboardModel;
  panel: PanelModel;
}


export type Props = OwnProps;

interface State {
  validatonMessage: string;
  showStateHistory: boolean;
  showDeleteConfirmation: boolean;
  showTestRule: boolean;
  frequencyWarning: string
}

class UnConnectedAlertTab extends PureComponent<Props, State> {
  notifications: any;
  alertNotifications: any;
  alertingMinIntervalSecs: number;
  alertingMinInterval: string;
  evalOperators: any;
  evalFunctions: any;
  constructor(props) {
    super(props)

    this.alertingMinIntervalSecs = config.alertingMinInterval;
    this.alertingMinInterval = kbn.secondsToHms(config.alertingMinInterval);
    this.notifications = [];
    this.alertNotifications = [];
    this.evalOperators = alertDef.evalOperators
    this.evalFunctions = alertDef.evalFunctions;
    this.state = {
      validatonMessage: '',
      showStateHistory: false,
      showDeleteConfirmation: false,
      showTestRule: false,
      frequencyWarning: null
    }
  }

  componentDidMount() {
    this.loadAlertTab();
    this.initAlertModel()
  }

  onAngularPanelUpdated = () => {
    this.forceUpdate();
  };

  componentDidUpdate(prevProps: Props) {
    this.loadAlertTab();
  }

  componentWillUnmount() {
  }

  async loadAlertTab() {
    const { panel } = this.props;

    const validatonMessage = await getAlertingValidationMessage(
      panel.transformations,
      panel.targets,
      getDataSourceService(),
      panel.datasource
    );

    if (validatonMessage) {
      this.setState({ validatonMessage });
    }
  }

  onAddAlert = () => {
    this.props.panel.alert = {
      for: '5m'
    };
    this.initAlertModel()
    this.forceUpdate();
  };

  initAlertModel() {
    const alert = this.props.panel.alert;
    if (!alert) {
      return;
    }

    this.checkFrequency(alert.frequency);

    alert.conditions = alert.conditions || [];
    if (alert.conditions.length === 0) {
      alert.conditions.push(getDefaultCondition());
    }

    alert.noDataState = alert.noDataState || config.alertingNoDataOrNullValues;
    alert.executionErrorState = alert.executionErrorState || config.alertingErrorOrTimeout;
    alert.frequency = alert.frequency || '1m';
    alert.handler = alert.handler || 1;
    alert.notifications = alert.notifications || [];
    alert.for = alert.for || '0m';
    alert.alertRuleTags = alert.alertRuleTags || {};

    const defaultName = this.props.panel.title + ' alert';
    alert.name = alert.name || defaultName;

    ThresholdMapper.alertToGraphThresholds(this.props.panel);

    for (const addedNotification of alert.notifications) {
      // lookup notifier type by uid
      let model: any = _.find(this.notifications, { uid: addedNotification.uid });

      // fallback to using id if uid is missing
      if (!model) {
        model = _.find(this.notifications, { id: addedNotification.id });
      }

      if (model && model.isDefault === false) {
        model.iconClass = this.getNotificationIcon(model.type);
        this.alertNotifications.push(model);
      }
    }

    for (const notification of this.notifications) {
      if (notification.isDefault) {
        notification.iconClass = this.getNotificationIcon(notification.type);
        this.alertNotifications.push(notification);
      }
    }

    this.props.panel.render();
  }


  getNotificationIcon(type: string): string {
    switch (type) {
      case 'email':
        return 'envelope';
      case 'slack':
        return 'slack';
      case 'victorops':
        return 'fa fa-pagelines';
      case 'webhook':
        return 'cube';
      case 'pagerduty':
        return 'fa fa-bullhorn';
      case 'opsgenie':
        return 'bell';
      case 'hipchat':
        return 'fa fa-mail-forward';
      case 'pushover':
        return 'mobile-android';
      case 'kafka':
        return 'arrow-random';
      case 'teams':
        return 'fa fa-windows';
    }
    return 'bell';
  }

  checkFrequency = (v) => {
    if (!v) {
      return;
    }

    try {
      const frequencySecs = kbn.interval_to_seconds(v);
      if (frequencySecs < this.alertingMinIntervalSecs) {
        this.setState({
          frequencyWarning: 'A minimum evaluation interval of ' +
            this.alertingMinInterval +
            ' have been configured in Grafana and will be used for this alert rule. ' +
            'Please contact the administrator to configure a lower interval.'
        })

      } else {
        this.setState({
          frequencyWarning: null
        })
      }
    } catch (err) {
      this.setState({
        frequencyWarning: `Invalid interval string, has to be either unit-less or end with one of the following units: "y, M, w, d, h, m, s, ms"`
      })
    }
  }

  switchToQueryTab = () => {
    updateLocation({ query: { tab: PanelEditorTabId.Query }, partial: true });
  };

  onToggleModal = (prop: keyof Omit<State, 'validatonMessage'>) => {
    const value = this.state[prop];
    this.setState({ ...this.state, [prop]: !value });
  };

  renderValidationMessage = () => {
    const { validatonMessage } = this.state;

    return (
      <div
        className={css`
          width: 508px;
          margin: 128px auto;
        `}
      >
        <h2>{validatonMessage}</h2>
        <br />
        <div className="gf-form-group">
          <Button size={'md'} variant={'secondary'} icon="arrow-left" onClick={this.switchToQueryTab}>
            Go back to Queries
          </Button>
        </div>
      </div>
    );
  };

  renderTestRule = () => {
    if (!this.state.showTestRule) {
      return null;
    }

    const { panel, dashboard } = this.props;
    const onDismiss = () => this.onToggleModal('showTestRule');

    return (
      <Modal isOpen={true} icon="bug" title="Testing rule" onDismiss={onDismiss} onClickBackdrop={onDismiss}>
        <TestRuleResult panel={panel} dashboard={dashboard} />
      </Modal>
    );
  };

  renderDeleteConfirmation = () => {
    if (!this.state.showDeleteConfirmation) {
      return null;
    }

    const { panel } = this.props;
    const onDismiss = () => this.onToggleModal('showDeleteConfirmation');

    return (
      <ConfirmModal
        isOpen={true}
        icon="trash-alt"
        title="Delete"
        body={
          <div>
            Are you sure you want to delete this alert rule?
            <br />
            <small>You need to save dashboard for the delete to take effect.</small>
          </div>
        }
        confirmText="Delete Alert"
        onDismiss={onDismiss}
        onConfirm={() => {
          delete panel.alert;
          panel.options.thresholds = [];
          this.props.panel.render();
          onDismiss();
        }}
      />
    );
  };

  renderStateHistory = () => {
    if (!this.state.showStateHistory) {
      return null;
    }

    const { panel, dashboard } = this.props;
    const onDismiss = () => this.onToggleModal('showStateHistory');

    return (
      <Modal isOpen={true} icon="history" title="State history" onDismiss={onDismiss} onClickBackdrop={onDismiss}>
        <StateHistory
          dashboard={dashboard}
          panelId={panel.editSourceId ?? panel.id}
          onRefresh={() => this.props.panel.refresh()}
        />
      </Modal>
    );
  };

  addCondition = () => {
    const condition = getDefaultCondition();
    // add to persited model
    this.props.panel.alert.conditions.push(condition);

    // action above cant trigger a view re-render, so we need add ugly code here
    this.forceUpdate()
  }

  removeCondition = (i) => {
    const conditions = _.cloneDeep(this.props.panel.alert.conditions)
    conditions.splice(i, 1)
    this.props.panel.alert.conditions = conditions
    console.log(_.cloneDeep(this.props.panel.alert.conditions))
    this.forceUpdate()
  }
  render() {
    const { transformations, alert, targets } = this.props.panel;
    const { validatonMessage, frequencyWarning } = this.state;
    const hasTransformations = transformations && transformations.length > 0;

    if (!alert && validatonMessage) {
      return this.renderValidationMessage();
    }

    const model = {
      title: 'Panel has no alert rule defined',
      buttonIcon: 'bell' as IconName,
      onClick: this.onAddAlert,
      buttonTitle: 'Create Alert',
    };

    return (
      <>
        <CustomScrollbar autoHeightMin="100%">
          <Container padding="md">
            <div>
              {alert && hasTransformations && (
                <Alert
                  severity={AppNotificationSeverity.Error}
                  title="Transformations are not supported in alert queries"
                />
              )}

              {alert && <div className="gf-form-group">
                <h4 className="section-heading">Rule</h4>
                <div className="gf-form-inline">
                  <div className="gf-form">
                    <span className="gf-form-label width-5">Name</span>
                    <input type="text" className="gf-form-input" defaultValue={alert.name} onChange={(e) => alert.name = e.currentTarget.value} />
                  </div>
                  <div className="gf-form">
                    <span className="gf-form-label width-7">Evaluate every</span>
                    <input
                      className="gf-form-input max-width-5"
                      type="text"
                      defaultValue={alert.frequency}
                      onChange={(e) => this.props.panel.alert.frequency = e.currentTarget.value}
                      onBlur={(e) => this.checkFrequency(e.currentTarget.value)}
                    />
                  </div>
                  <div className="gf-form">
                    <InlineFormLabel className="gf-form-label" tooltip="If an alert rule has a configured For and the query violates the configured threshold it will first go from OK to Pending. Going from OK to Pending Grafana will not send any notifications. Once the alert rule has been firing for more than For duration, it will change to Alerting and send alert notifications.">
                      For
                    </InlineFormLabel>
                    <input
                      type="text"
                      className="gf-form-input max-width-10 gf-form-input--has-help-icon"
                      defaultValue={alert.for}
                      onChange={(e) => this.props.panel.alert.for = e.currentTarget.value}
                      placeholder="5m"
                      onBlur={(e) => this.checkFrequency(e.currentTarget.value)}
                    />
                  </div>
                </div>
                {frequencyWarning && <div className="gf-form">
                  <label className="gf-form-label text-warning">
                    <Icon name="'exclamation-triangle'"></Icon> {frequencyWarning}
                  </label>
                </div>}
              </div>}

              {alert &&
                <>
                  <div className="gf-form-group">
                    <h4 className="section-heading">Conditions</h4>
                    {
                      alert.conditions.map((c, i) => {
                        console.log(i,c)
                        return <div className="gf-form-inline" key={i}>
                          <div className="gf-form">
                            {i === 0 ?
                              <span className="gf-form-label query-keyword width-5">WHEN</span> :
                              <span className="width-5 ub-mr2">
                                <Select value={c.operator} onChange={(v) => {c.operator = v;this.forceUpdate()}} style={{ width: '100%' }}>
                                  <Option value="and">AND</Option>
                                  <Option value="or">OR</Option>
                                </Select>
                              </span>
                            }
                            <Select className="width-5" value={c.reducer} onChange={(v) => {c.reducer = v;this.forceUpdate()}}>
                              {alertDef.reducerTypes.map((r, i) => <Option value={r.value} key={i}>{r.text}</Option>)}
                            </Select>
                            <span className="gf-form-label query-keyword width-5 ub-ml2">OF QUERY</span>
                            <Select className="width-4" value={c.queryRefId} onChange={(v) => {c.queryRefId = v;this.forceUpdate()}}>
                              {targets.map((r, i) => <Option value={r.refId} key={i}>{r.refId}</Option>)}
                            </Select>

                            <Select className="width-11 ub-ml2" value={c.evaluator.type} onChange={(v) => { c.evaluator.type = v; this.forceUpdate() }}>
                              {alertDef.evalFunctions.map((r, i) => <Option value={r.value} key={i}>{r.text}</Option>)}
                            </Select>
                            {c.evaluator.type !== 'no_value' && <InputNumber
                              className="ub-ml2 width-4"
                              value={c.evaluator.params[0]}
                              onChange={(v) => {c.evaluator.params[0] = v;this.forceUpdate()}}
                              placeholder="5"
                            />}
                            {(c.evaluator.type === 'outside_range' || c.evaluator.type === 'within_range') &&
                              <>
                                <span className="gf-form-label query-keyword width-2 ub-ml2">TO</span>
                                <InputNumber
                                  className="width-4"
                                  value={c.evaluator.params[1]}
                                  onChange={(v) => {c.evaluator.params[1] = v;this.forceUpdate()}}
                                  placeholder="5"
                                />
                              </>}

                            <span className="gf-form-label query-keyword width-3 ub-ml2">LAST</span>
                            <Select className="width-4" value={c.lastFor} onChange={(v) => { c.lastFor = v;this.forceUpdate() }}>
                              {alertDef.lastForOptions.map((r, i) => <Option value={r} key={i}>{r}</Option>)}
                            </Select>

                            <label className="gf-form-label dropdown pointer ub-ml2" onClick={() => this.removeCondition(i)}>
                              <Icon name="trash-alt" />
                            </label>
                          </div>

                        </div>
                      })
                    }
                    <div className="gf-form">
                      <label className="gf-form-label dropdown pointer" onClick={this.addCondition}>
                        <Icon name="plus-circle" />
                      </label>
                    </div>

                  </div>
                </>}

              {alert && (
                <HorizontalGroup>
                  <Button onClick={() => this.onToggleModal('showStateHistory')} variant="secondary">
                    State history
                  </Button>
                  <Button onClick={() => this.onToggleModal('showTestRule')} variant="secondary">
                    Test rule
                  </Button>
                  <Button onClick={() => this.onToggleModal('showDeleteConfirmation')} variant="destructive">
                    Delete
                  </Button>
                </HorizontalGroup>
              )}
              {!alert && !validatonMessage && <EmptyListCTA {...model} />}
            </div>
          </Container>
        </CustomScrollbar>

        {this.renderTestRule()}
        {this.renderDeleteConfirmation()}
        {this.renderStateHistory()}
      </>
    );
  }
}



export const AlertTab = UnConnectedAlertTab;
