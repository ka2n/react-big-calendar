import React from 'react';
import { findDOMNode } from 'react-dom';
import cn from 'classnames';
import dates from './utils/dates';
import { accessor as get } from './utils/accessors';
import localizer from './localizer'
import chunk from 'lodash/array/chunk';
import omit from 'lodash/object/omit';
import findIndex from 'lodash/array/findIndex';

import { navigate } from './utils/constants';
import { notify } from './utils/helpers';
import getHeight from 'dom-helpers/query/height';
import getPosition from 'dom-helpers/query/position';
import raf from 'dom-helpers/util/requestAnimationFrame';

import EventCell from './EventCell';
import EventRow from './EventRow';
import EventEndingRow from './EventEndingRow';
import Popup from './Popup';
import Overlay from 'react-overlays/lib/Overlay';
import BackgroundCells from './BackgroundCells';

import { dateFormat } from './utils/propTypes';
import {
    segStyle, inRange, eventSegments
  , endOfRange, eventLevels, sortEventsByStart } from './utils/eventLevels';

let eventsForWeek = (evts, start, end, props) =>
  evts.filter(e => inRange(e, start, end, props));

let segmentWeeks = (weeks, events, props) => {
  events.sort((a, b) => sortEventsByStart(a, b, props))
  const weekEvents = weeks.map((weekDays) => {
    const evts = eventsForWeek(events, weekDays[0], weekDays[weekDays.length - 1], props)
    return evts
  })
  return weekEvents
}

let isSegmentInSlot = (seg, slot) => seg.left <= slot && seg.right >= slot;

let propTypes = {
  ...EventRow.PropTypes,

  culture: React.PropTypes.string,

  date: React.PropTypes.instanceOf(Date),

  min: React.PropTypes.instanceOf(Date),
  max: React.PropTypes.instanceOf(Date),

  dateFormat,

  weekdayFormat: dateFormat,

  popup: React.PropTypes.bool,

  popupOffset: React.PropTypes.oneOfType([
    React.PropTypes.number,
    React.PropTypes.shape({
      x: React.PropTypes.number,
      y: React.PropTypes.number
    })
  ]),

  onSelectEvent: React.PropTypes.func,
  onSelectSlot: React.PropTypes.func
};

let MonthView = React.createClass({

  displayName: 'MonthView',

  propTypes,

  getDefaultProps() {
    return {
      slots: 7
    }
  },

  getInitialState(){
    return {
      // rowLimit: 5,
      // needLimitMeasure: true
    }
  },

  componentWillMount() {
    this._bgRows = []
    this._pendingSelection = []
  },

  componentWillReceiveProps({ date }) {
    // this.setState({
    //   needLimitMeasure: !dates.eq(date, this.props.date)
    // })
  },

  componentDidMount() {
    let running;

    // if (this.state.needLimitMeasure)
    //   this._measureRowLimit(this.props)
    //
    // window.addEventListener('resize', this._resizeListener = ()=> {
    //   if (!running) {
    //     raf(()=> {
    //       running = false
    //       this.setState({ needLimitMeasure: true }) //eslint-disable-line
    //     })
    //   }
    // }, false)
  },

  componentDidUpdate() {
    // if (this.state.needLimitMeasure)
    //   this._measureRowLimit(this.props)
  },

  componentWillUnmount() {
    window.removeEventListener('resize', this._resizeListener, false)
  },

  _scroll(){
    this.props.onScroll && this.props.onScroll.call(null, 'month')
  },

  render() {
    let { date, culture, weekdayFormat, className } = this.props
      , month = dates.visibleDays(date, culture)
      , weeks  = chunk(month, this.props.slots);

    // let measure = this.state.needLimitMeasure
    let measure = false

    this._weekCount = weeks.length;

    const weekEvents = segmentWeeks(weeks, this.props.events, this.props)

    return (
      <div className={cn('rbc-month-view', className)} onScroll={this._scroll}>
        <div className='rbc-month-header-wrapper'>
          <div className='rbc-row rbc-month-header'>
            <div className='rbc-month-header-inner'>
              {this._headers(weeks[0], weekdayFormat, culture)}
            </div>
          </div>
        </div>
        <div className='rbc-month-wrapper'>
          <div className='rbc-month-container'>
            <div className='rbc-month-inner'>
              { weeks.map((week, idx) =>
                  this.renderWeek(week, idx, weeks.length, weekEvents[idx], measure && this._renderMeasureRows))
              }
            </div>
          </div>
        </div>
      </div>
    )
  },

  renderWeek(week, weekIdx, numWeeks, evts, content) {
    let dailyEvents = evts.reduce((days, event) => {
      let start = dates.startOf(get(event, this.props.startAccessor), 'day')
      let dayIdx = week.findIndex((day) => { return day.valueOf() == start.valueOf() })
      days[dayIdx].push(event)
      return days
    }, week.map((_) => []))

    let rowStyle = {
    }

    return (
      <div key={'week_' + weekIdx}
        className='rbc-month-row'
        style={rowStyle}
        ref={!weekIdx && (r => this._firstRow = r)}
      >
        {
          this.renderBackground(week, weekIdx)
        }
        <div className='rbc-row-content'>
        <table>
          <tbody>
          <tr
            className='rbc-row'
            ref={!weekIdx && (r => this._firstDateRow = r)}
          >
            { this._dates(week) }
          </tr>
          <tr className="rbc-row">
            <td colSpan={this.props.slots}>
              { dailyEvents.map((events) => this.renderDayEvents(events)) }
            </td>
          </tr>
         </tbody></table>
        </div>
        { this.props.popup
            && this._renderOverlay()
        }
      </div>
    )
  },

  renderDayEvents(events) {
    let cells = events.map((event) => (
        <EventCell
            {...this.props}
            event={event}
            component={this.props.components.event}
            onSelect={this._selectEvent}
        />
    ))
    return (<div className="rbc-day-col">{ cells.length > 0 ? cells : ('\u00A0') }</div>)
  },

  renderBackground(row, idx){
    let self = this;

    function onSelectSlot({ start, end }) {
      self._pendingSelection = self._pendingSelection
        .concat(row.slice(start, end + 1))

      clearTimeout(self._selectTimer)
      self._selectTimer = setTimeout(()=> self._selectDates())
    }

    let today = new Date()
    let todayIndex = findIndex(row, day => dates.eq(day, today, 'day'))

    return (
    <BackgroundCells
      container={() => findDOMNode(this)}
      selectable={this.props.selectable}
      todayIndex={todayIndex}
      slots={this.props.slots}
      ref={r => this._bgRows[idx] = r}
      onSelectSlot={onSelectSlot}
    />
    )
  },

  renderRowLevel(segments, week, idx){
    let { first, last } = endOfRange(week);

    return (
      <EventRow
        {...this.props}
        eventComponent={this.props.components.event}
        onSelect={this._selectEvent}
        key={idx}
        segments={segments}
        start={first}
        end={last}
      />
    )
  },

  renderShowMore(segments, extraSegments, week, weekIdx) {
    let { first, last } = endOfRange(week);

    let onClick = slot => this._showMore(segments, week[slot - 1], weekIdx, slot)

    return (
      <EventEndingRow
        {...this.props}
        eventComponent={this.props.components.event}
        onSelect={this._selectEvent}
        onShowMore={onClick}
        key={'last_row_' + weekIdx}
        segments={extraSegments}
        start={first}
        end={last}
      />
    )
  },

  _dates(row){
    let numRow = row.length
    return row.map((day, colIdx) => {
      var offRange = dates.month(day) !== dates.month(this.props.date);
      let style = { width: `${100 / numRow}%` }

      return (
        <td
          key={'header_' + colIdx}
          style={style}
          className={cn('rbc-date-cell', {
            'rbc-off-range': offRange,
            'rbc-now': dates.eq(day, new Date(), 'day'),
            'rbc-current': dates.eq(day, this.props.date, 'day')
          })}
        >
          <a href='#' onClick={this._dateClick.bind(null, day)}>
            { localizer.format(day, this.props.dateFormat, this.props.culture) }
          </a>
        </td>
      )
    })
  },

  _headers(row, format, culture){
    let first = row[0]
    let last = row[row.length - 1]

    return dates.range(first, last, 'day').map((day, idx) =>
      <div
        key={'header_' + idx}
        className='rbc-header'
      >
        { localizer.format(day, format, culture) }
      </div>
    )
  },

  _renderMeasureRows(levels, row, idx) {
    let first = idx === 0;

    return first ? (
      <div className='rbc-row'>
        <div className='rbc-row-segment' style={segStyle(1, this.props.slots)}>
          <div ref={r => this._measureEvent = r} className={cn('rbc-event')}>
            <div className='rbc-event-content'>&nbsp;</div>
          </div>
        </div>
      </div>
    ) : <span/>
  },

  _renderOverlay(){
    let overlay = (this.state && this.state.overlay) || {};
    let { components } = this.props;

    return (
      <Overlay
        rootClose
        placement='bottom'
        container={this}
        show={!!overlay.position}
        onHide={() => this.setState({ overlay: null })}
      >
        <Popup
          {...this.props}
          eventComponent={components.event}
          position={overlay.position}
          events={overlay.events}
          slotStart={overlay.date}
          slotEnd={overlay.end}
          onSelect={this._selectEvent}
        />
      </Overlay>
    )
  },

  _measureRowLimit() {
    let eventHeight = getHeight(this._measureEvent);
    let labelHeight = getHeight(this._firstDateRow);
    let eventSpace = getHeight(this._firstRow) - labelHeight;

    this._needLimitMeasure = false;

    this.setState({
      needLimitMeasure: false,
      rowLimit: Math.max(
        Math.floor(eventSpace / eventHeight), 1)
    })
  },

  _dateClick(date, e){
    e.preventDefault();
    this.clearSelection()
    notify(this.props.onNavigate, [navigate.DATE, date])
  },

  _selectEvent(...args){
    //cancel any pending selections so only the event click goes through.
    this.clearSelection()

    notify(this.props.onSelectEvent, args)
  },

  _selectDates(){
    let slots = this._pendingSelection.slice()

    this._pendingSelection = []

    slots.sort((a, b) => +a - +b)

    notify(this.props.onSelectSlot, {
      slots,
      start: slots[0],
      end: slots[slots.length - 1]
    })
  },

  _showMore(segments, date, weekIdx, slot){
    let cell = findDOMNode(this._bgRows[weekIdx]).children[slot - 1];

    let events = segments
      .filter(seg => isSegmentInSlot(seg, slot))
      .map(seg => seg.event)

    //cancel any pending selections so only the event click goes through.
    this.clearSelection()

    if (this.props.popup) {
      let position = getPosition(cell, findDOMNode(this));

      this.setState({
        overlay: { date, events, position }
      })
    }
    else {
      notify(this.props.onNavigate, [navigate.DATE, date])
    }

    notify(this.props.onShowMore, [events, date, slot])
  },

  clearSelection(){
    clearTimeout(this._selectTimer)
    this._pendingSelection = [];
  }

});

MonthView.navigate = (date, action)=>{
  switch (action){
    case navigate.PREVIOUS:
      return dates.add(date, -1, 'month');

    case navigate.NEXT:
      return dates.add(date, 1, 'month')

    default:
      return date;
  }
}

MonthView.range = (date, { culture }) => {
  let start = dates.firstVisibleDay(date, culture)
  let end = dates.lastVisibleDay(date, culture)
  return { start, end }
}

export default MonthView
