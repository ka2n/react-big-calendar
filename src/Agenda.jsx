import React, { PropTypes } from 'react';

import groupBy from 'lodash/collection/groupBy';
import message from './utils/messages';
import localizer from './localizer'

import dates from './utils/dates';
import { notify } from './utils/helpers';
import { navigate } from './utils/constants';
import { accessor as get } from './utils/accessors';

import classes from 'dom-helpers/class';
import cn from 'classnames';
import getWidth from 'dom-helpers/query/width';
import scrollbarSize from 'dom-helpers/util/scrollbarSize';
import { inRange } from './utils/eventLevels';
import { sortEventsByStart } from './utils/eventLevels';


let Agenda = React.createClass({

  propTypes: {
    messages: PropTypes.shape({
      date: PropTypes.string,
      time: PropTypes.string,
      event: PropTypes.string
    })
  },

  getDefaultProps() {
    return {
      length: 30
    };
  },

  componentDidMount() {
    this._adjustHeader()
  },

  componentDidUpdate() {
    this._adjustHeader()
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !(
      this.props.events == nextProps.events
    )
  },

  _scroll() {
    this.props.onScroll && this.props.onScroll.call(null, 'agenda')
  },

  render() {
    let { length, date, events, culture, startAccessor } = this.props;
    let messages = message(this.props.messages);
    // let end = dates.add(date, length, 'day')

    // 表示範囲は1ヶ月間(週を考慮しない)
    let range = dates.range(dates.startOf(date, 'month'), dates.endOf(date, 'month'))
    date = range[0]
    let end = range[range.length - 1]

    // let range = dates.range(date, end, 'day');

    // events = events.filter(event =>
    //   inRange(event, date, end, this.props)
    // )

    // events.sort((a, b) => +get(a, startAccessor) - +get(b, startAccessor))
    events.sort((a, b) => sortEventsByStart(a, b, this.props))

    // 日毎のeventsのObjectにする
    const dayEvents = groupBy(events, (e) => {
      return get(e, startAccessor).toDateString()
    })

    return (
      <div className='rbc-agenda-view' onScroll={this._scroll}>
        <table ref='header'>
          <thead>
            <tr>
              <th className='rbc-header' ref='dateCol'>
                {messages.date}
              </th>
              <th className='rbc-header' ref='timeCol'>
                {messages.time}
              </th>
              <th className='rbc-header'>
                {messages.event}
              </th>
            </tr>
          </thead>
        </table>
        <div className='rbc-agenda-content' ref='content'>
          <table>
            <tbody ref='tbody'>
              { range.map((day, idx) => this.renderDay(day, dayEvents, idx)) }
            </tbody>
          </table>
        </div>
      </div>
    );
  },

  renderDay(day, events, dayKey){
    let {
        culture, components
      , titleAccessor, agendaDateFormat } = this.props;

    let EventComponent = components.event;
    let DateComponent = components.date;

    // events = events.filter(e => inRange(e, day, day, this.props))
    events = events[day.toDateString()] || []
    if (events.length == 0) {
      return null
    }

    let today = dates.eq(new Date(), day, 'day')

    return events.map((event, idx) => {
      let dateLabel = idx === 0 && localizer.format(day, agendaDateFormat, culture)
      let first = idx === 0
          ? (
            <td rowSpan={events.length} className='rbc-agenda-date-cell'>
              { DateComponent
                ? <DateComponent day={day} label={dateLabel}/>
                : <span role="button" onClick={this._dateClick.bind(null, day)}>{ dateLabel }</span>
              }
            </td>
          ) : false

      let title = get(event, titleAccessor)

      return (
        <tr key={dayKey + '_' + idx} className={cn({
        'rbc-day-headline': !!first,
        'rbc-now': today
        })}>
          {first}
          <td className='rbc-agenda-time-cell'>
            { this.timeRangeLabel(day, event) }
          </td>
          <td className='rbc-agenda-event-cell'>
            { EventComponent
                ? <EventComponent event={event} title={title}/>
                : title
            }
          </td>
        </tr>
      )
    }, [])
  },

  timeRangeLabel(day, event){
    let {
        endAccessor, startAccessor, allDayAccessor
      , culture, messages, components } = this.props;

    let labelClass = ''
      , TimeComponent = components.time
      , label = message(messages).allDay

    let start = get(event, startAccessor)
    let end = get(event, endAccessor)

    if (!get(event, allDayAccessor)) {
      if (dates.eq(start, end, 'day')){
        label = localizer.format({ start, end }, this.props.agendaTimeRangeFormat, culture)
      }
      else if (dates.eq(day, start, 'day')){
        label = localizer.format(start, this.props.agendaTimeFormat, culture)
      }
      else if (dates.eq(day, end, 'day')){
        label = localizer.format(end, this.props.agendaTimeFormat, culture)
      }
    }

    if (dates.gt(day, start, 'day')) labelClass = 'rbc-continues-prior'
    if (dates.lt(day, end, 'day'))   labelClass += ' rbc-continues-after'

    return (
      <span className={labelClass.trim()}>
        { TimeComponent
          ? <TimeComponent event={event} label={label}/>
          : label
        }
      </span>
    )
  },

  _adjustHeader() {
    let header = this.refs.header;
    let firstRow = this.refs.tbody.firstChild

    if (!firstRow)
      return

    let isOverflowing = this.refs.content.scrollHeight > this.refs.content.clientHeight;
    let widths = this._widths || []

    this._widths = [
      getWidth(firstRow.children[0]),
      getWidth(firstRow.children[1])
    ]

    if (widths[0] !== this._widths[0] || widths[1] !== this._widths[1]) {
      this.refs.dateCol.style.width = this._widths[0] + 'px'
      this.refs.timeCol.style.width = this._widths[1] + 'px';
    }

    if (isOverflowing) {
      classes.addClass(header, 'rbc-header-overflowing')
      header.style.marginRight = scrollbarSize() + 'px'
    }
    else {
      classes.removeClass(header, 'rbc-header-overflowing')
    }
  },

  _dateClick(date, e){
    e.preventDefault()
    notify(this.props.onNavigate, [navigate.DATE, date])
  }
});

Agenda.navigate = (date, action)=>{
  switch (action){
    case navigate.PREVIOUS:
      date = dates.add(date, -1, 'month');
      break;

    case navigate.NEXT:
      date = dates.add(date, 1, 'month');
      break;
  }
  return date
}

Agenda.range = (date, { length = Agenda.defaultProps.length }) => {
  let start = dates.startOf(date, 'month')
  let end = dates.endOf(date, 'month')
  return { start, end }
}

export default Agenda
