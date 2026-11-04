import './styles.css';
import { SmartRoomApplication } from './app';

const root = document.querySelector<HTMLElement>('#app');

if (root) {
  root.dataset.stage = '16';
  const application = new SmartRoomApplication(root);
  void application.start();
}
