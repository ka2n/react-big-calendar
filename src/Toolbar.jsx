import React from 'react';
import cn from 'classnames';
import message from './utils/messages';
import { navigate } from './utils/constants';

let Toolbar = React.createClass({

  render() {
    let { messages, label } = this.props;

    messages = message(messages)

    return (
      <div className='rbc-toolbar'>
        <span className={cn(['rbc-btn-group', 'rbc-toolbar-left'])}>
          <button
            type='button'
            onClick={this.navigate.bind(null, navigate.TODAY)}
            className="rbc-btn-today"
          >
            {messages.today}
          </button>
          <button
            type='button'
            className="rbc-btn-previous"
            onClick={this.navigate.bind(null, navigate.PREVIOUS)}
          >
            {messages.previous}
          </button>
          <span
            className={cn(['rbc-toolbar-label', 'rbc-toolbar-title'])}
          >
            { label }
          </span>
          <button
            type='button'
            onClick={this.navigate.bind(null, navigate.NEXT)}
            className="rbc-btn-next"
          >
            {messages.next}
          </button>
        </span>

        <span className={cn(['rbc-btn-group', 'rbc-toolbar-right'])}>
          {
            this.viewNamesGroup(messages)
          }
        </span>
      </div>
    );
  },

  navigate(action){
    this.props.onNavigate(action)
  },

  view(view){
    this.props.onViewChange(view)
  },

  viewNamesGroup(messages) {
    let viewNames = this.props.views
    const view = this.props.view

    if (viewNames.length > 1) {
      return (
        viewNames.map(name =>
          <button type='button' key={name}
            className={cn({'rbc-active': view === name})}
            onClick={this.view.bind(null, name)}
          >
            {messages[name]}
          </button>
        )
      )
    }
  }
});

export default Toolbar;
