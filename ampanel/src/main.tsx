import { render } from 'preact';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './app';

render(<App />, document.getElementById('app')!);
