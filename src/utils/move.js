import { navigate } from './constants';
import VIEWS from '../Views';

export default function moveDate(action, date, view){
  if (action == navigate.TODAY) {
    date = new Date();
  }
  date = VIEWS[view].navigate(date, action)
  return date
}
