import React from 'react';
import dates from './utils/dates';
import localizer from './localizer';
import { navigate } from './utils/constants';

import TimeGrid from './TimeGrid';

let Week = React.createClass({

  propTypes: TimeGrid.propTypes,

  getDefaultProps() {
    return TimeGrid.defaultProps
  },

  render() {
    let { date } = this.props
    let { start, end } = Week.range(date, this.props)

    return (
      <TimeGrid {...this.props} start={start} end={end} eventOffset={15}/>
    );
  }

});

Week.navigate = (date, action)=>{
  switch (action){
    case navigate.PREVIOUS:
      return dates.add(date, -1, 'week');

    case navigate.NEXT:
      return dates.add(date, 1, 'week')

    default:
      return date;
  }
}

Week.range = (date, { culture }) => {
  let firstOfWeek = localizer.startOfWeek(culture)
  var start = dates.startOf(date, 'week', firstOfWeek)
  var end = dates.endOf(date, 'week', firstOfWeek)
  start = dates.skipWeekends(start, 1)
  end = dates.skipWeekends(end, -1)

  return { start, end }
}


export default Week
