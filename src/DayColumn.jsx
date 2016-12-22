import React from 'react';
import { findDOMNode } from 'react-dom';
import cn from 'classnames';

import Selection, { getBoundsForNode } from './Selection';
import dates from './utils/dates';
import { isSelected } from './utils/selection';
import localizer from './localizer'

import { notify } from './utils/helpers';
import { accessor } from './utils/propTypes';
import { accessor as get } from './utils/accessors';

import TimeColumn from './TimeColumn'

function snapToSlot(date, step){
  var roundTo = 1000 * 60 * step;
  return new Date(Math.floor(date.getTime() / roundTo) * roundTo)
}

function positionFromDate(date, min){
  return dates.diff(min, dates.merge(min, date), 'minutes')
}

function overlaps(event, events, prop, last) {
  let offset = last;
  if (!events.length) return last - 1
  events.some(nextEvent => {
    if (isSegmentOverlap(event, nextEvent, prop)) {
      return true
    }
    offset = offset - 1
  })
  return Math.max(offset, -1)
}

function maxOverlaps(event, events, props) {
  let overlaps = 0;
  var prev = event;
  events.some(nextEvent => {
    if (isSegmentOverlap(prev, nextEvent, props)) {
      overlaps = Math.max(overlaps, nextEvent.level)
      prev = nextEvent
    } else {
      return false;
    }
  })
  return overlaps + 1;
}

function calculateLevels(events, accessors) {
  // レベル分けする
  let levels = {};
  events.forEach(event => {
    var currentLevel = 0;
    Object.keys(levels).some(l => {
      let level = levels[l];
      if (level.every(e => {
          return !isSegmentOverlap(event, e, accessors)
        })) {
        return true;
      } else {
        currentLevel = currentLevel + 1;
      }
    })

    event.level = currentLevel;
    (levels[currentLevel] = (levels[currentLevel] || [])).push(event)
  });
  return levels
}

function isSegmentOverlap(eventA, eventB, { startAccessor, endAccessor }) {
  return dates.gt(get(eventA, endAccessor), get(eventB, startAccessor)) && dates.lt(get(eventA, startAccessor), get(eventB, endAccessor))
}

let DaySlot = React.createClass({

  propTypes: {
    events: React.PropTypes.array.isRequired,
    step: React.PropTypes.number.isRequired,
    min: React.PropTypes.instanceOf(Date).isRequired,
    max: React.PropTypes.instanceOf(Date).isRequired,

    allDayAccessor: accessor.isRequired,
    startAccessor: accessor.isRequired,
    endAccessor: accessor.isRequired,

    selectable: React.PropTypes.bool,
    eventOffset: React.PropTypes.number,

    onSelecting: React.PropTypes.func,
    onSelectSlot: React.PropTypes.func.isRequired,
    onSelectEvent: React.PropTypes.func.isRequired,

    className: React.PropTypes.string
  },

  getInitialState() {
    return { selecting: false };
  },


  componentDidMount() {
    this.props.selectable
    && this._selectable()
  },

  componentWillUnmount() {
    this._teardownSelectable();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.selectable && !this.props.selectable)
      this._selectable();
    if (!nextProps.selectable && this.props.selectable)
      this._teardownSelectable();
  },

  render() {
    const {
      min,
      max,
      step,
      timeslots,
      now,
      selectRangeFormat,
      culture,
      ...props
    } = this.props
    this._totalMin = dates.diff(min, max, 'minutes')

    let { selecting, startSlot, endSlot } = this.state
      , style = this._slotStyle(startSlot, endSlot, 0)

    let selectDates = {
      start: this.state.startDate,
      end: this.state.endDate
    };

    return (
      <TimeColumn {...props}
        className='rbc-day-slot'
        timeslots={timeslots}
        now={now}
        min={min}
        max={max}
        step={step}
      >
        {this.renderEvents()}
        {
          selecting &&
          <div className='rbc-slot-selection' style={style}>
              <span>
              { localizer.format(selectDates, selectRangeFormat, culture) }
              </span>
          </div>
        }
      </TimeColumn>
    );
  },

  renderEvents() {
    let {
      events, step, min, culture, eventPropGetter
      , selected, eventTimeRangeFormat, eventComponent
      , startAccessor, endAccessor, titleAccessor } = this.props;

    let EventComponent = eventComponent
      , columns = 0;

    // 開始時間でソート, 同じ場合は終了が遅い方を先
    events.sort((a, b) => {
      let diff = +get(a, startAccessor) - +get(b, startAccessor)
      return diff == 0 ? +get(b, endAccessor) - +get(a, endAccessor) : diff
    })

    // レベル分けする
    // NOTE: eventsをmutateしているので大変に行儀が悪い
    calculateLevels(events, this.props);

    return events.map((event, idx) => {
      let start = get(event, startAccessor)
      let end = get(event, endAccessor)
      let startSlot = positionFromDate(start, min, step);
      let endSlot = positionFromDate(end, min, step);

      if (event.level == 0) {
        columns = maxOverlaps(event, events.slice(idx), this.props);
      }

      let style = this._slotStyle(startSlot, endSlot, event.level, columns)

      let title = get(event, titleAccessor)
      let label = localizer.format({ start, end }, eventTimeRangeFormat, culture);
      let _isSelected = isSelected(event, selected);

      if (eventPropGetter)
        var { style: xStyle, className } = eventPropGetter(event, start, end, _isSelected);

      return (
        <div
          key={'evt_' + idx}
          style={{...xStyle, ...style}}
          onClick={this._select.bind(null, event)}
          className={cn('rbc-event', className, {
            'rbc-selected': _isSelected,
            'rbc-event-overlaps': event.level !== 0
          })}
        >
          <div className='rbc-event-label'>{label}</div>
          <div className='rbc-event-content'>
            { EventComponent
              ? <EventComponent event={event} title={title}/>
              : title
            }
          </div>
        </div>
      )
    })
  },

  _slotStyle(startSlot, endSlot, level, columns){
    endSlot = Math.max(endSlot, startSlot + this.props.step); //must be at least one `step` high

    let top = ((startSlot / this._totalMin) * 100);
    let bottom = ((endSlot / this._totalMin) * 100);

    let left = level / columns * 100;
    let right = Math.max((100 - left) - 100/columns * 2, 0);

    return {
      top: top + '%',
      height: bottom - top + '%',
      left: left + '%',
      right: right + '%',
      marginRight: columns > 1 && level < (columns - 1) ? 20 : 0,
      marginLeft: level == 0 ? 2 : 0,
      zIndex: level
    }
  },

  _selectable(){
    let node = findDOMNode(this);
    let selector = this._selector = new Selection(()=> findDOMNode(this))

    let maybeSelect = (box) => {
      let onSelecting = this.props.onSelecting
      let current = this.state || {};
      let state = selectionState(box);
      let { startDate: start, endDate: end } = state;

      if (onSelecting) {
        if (
          (dates.eq(current.startDate, start, 'minutes') &&
          dates.eq(current.endDate, end, 'minutes')) ||
          onSelecting({ start, end }) === false
        )
          return
      }

      this.setState(state)
    }

    let selectionState = ({ y }) => {
      let { step, min, max } = this.props;
      let { top, bottom } = getBoundsForNode(node)

      let mins = this._totalMin;

      let range = Math.abs(top - bottom)

      let current = (y - top) / range;

      current = snapToSlot(minToDate(mins * current, min), step)

      if (!this.state.selecting)
        this._initialDateSlot = current

      let initial = this._initialDateSlot;

      if (dates.eq(initial, current, 'minutes'))
        current = dates.add(current, step, 'minutes')

      let start = dates.max(min, dates.min(initial, current))
      let end = dates.min(max, dates.max(initial, current))

      return {
        selecting: true,
        startDate: start,
        endDate: end,
        startSlot: positionFromDate(start, min, step),
        endSlot: positionFromDate(end, min, step)
      }
    }

    selector.on('selecting', maybeSelect)
    selector.on('selectStart', maybeSelect)

    selector
      .on('click', ({ x, y }) => {
        this._clickTimer = setTimeout(()=> {
          this._selectSlot(selectionState({ x, y }))
        })

        this.setState({ selecting: false })
      })

    selector
      .on('select', () => {
        if (this.state.selecting) {
          this._selectSlot(this.state)
          this.setState({ selecting: false })
        }
      })
  },

  _teardownSelectable() {
    if (!this._selector) return
    this._selector.teardown();
    this._selector = null;
  },

  _selectSlot({ startDate, endDate }) {
    let current = startDate
      , slots = [];

    while (dates.lte(current, endDate)) {
      slots.push(current)
      current = dates.add(current, this.props.step, 'minutes')
    }

    notify(this.props.onSelectSlot, {
      slots,
      start: startDate,
      end: endDate
    })
  },

  _select(event){
    clearTimeout(this._clickTimer);
    notify(this.props.onSelectEvent, event)
  }
});


function minToDate(min, date){
  var dt = new Date(date)
    , totalMins = dates.diff(dates.startOf(date, 'day'), date, 'minutes');

  dt = dates.hours(dt, 0);
  dt = dates.minutes(dt, totalMins + min);
  dt = dates.seconds(dt, 0)
  return dates.milliseconds(dt, 0)
}

export default DaySlot;
