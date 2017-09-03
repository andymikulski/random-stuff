const clamp = val => Math.max(0, Math.min(val, 1));

class Point {
  static Distance(pt1, pt2) {
    return ((pt2.x - pt1.x) ** 2) + ((pt2.y - pt1.y) ** 2);
  }

  constructor(_x, _y) {
    this.x = _x || 0;
    this.y = _y || 0;
  }
}

const size = 15;
const randomCoord = () => Math.floor(Math.random() * size);
const randomPoint = () => new Point(randomCoord(), randomCoord());


const hospital = [randomPoint(), randomPoint(), randomPoint()];
const food = [randomPoint(), randomPoint(), randomPoint()];
const work = [randomPoint(), randomPoint()];

const isTypeAtPoint = (type, pt) => !!type.find(item => item.x === pt.x && item.y === pt.y);

const getNearest = (type, pt) => {
  let closest;
  let distance = 999;

  type.filter(item => !item.isBusy).forEach((item) => {
  // type.forEach((item) => {
    const dist = Point.Distance(item, pt);
    if (dist < distance) {
      closest = item;
      distance = dist;
    }
  });

  return closest;
};


class Agent {
  constructor() {
    this.currentAction = null;
    this.needs = {};
    this.actions = {};
  }

  getInstinctPriorities() {
    return Object.keys(this.needs).sort((a, b) => this.needs[b] - this.needs[a]);
  }

  clone() {
    return JSON.parse(JSON.stringify(this));
  }

  tick() {
    const priorities = this.getInstinctPriorities();

    let bestGuess;
    let bestOption;
    console.log('checking priorities', priorities);
    // for each priority, starting with highest
    for (let i = 0; i < priorities.length; i += 1) {
      const trackedPriority = priorities[i];
      // see what options are available to fix the issue
      bestOption = Object.keys(this.actions).reduce((currChamp, contender)=>{
        if (!currChamp) { return contender; }
        const action = this.actions[contender];

        // weigh the costs of those options
        let contenderCost = action.cost();
        let champCost = this.actions[currChamp].cost();

        // weigh the benefits
        const contenderAction = this.actions[contender].action(this.clone());
        const contenderDesired = contenderAction.needs[trackedPriority] > 0;

        const champAction = this.actions[currChamp].action(this.clone());
        const champDesired = champAction.needs[trackedPriority] > contenderAction.needs[trackedPriority];

        if (champDesired && contenderDesired){
          return champCost < contenderCost ? currChamp : contender;
        } else if (champDesired && !contenderDesired) {
          return currChamp;
        } else if (!champDesired && contenderDesired) {
          return contender;
        }

        // console.log(`${trackedPriority} - ${contender} (${contenderCost}) vs ${currChamp} (${champCost})`);

        // choose the one that is less effort
        // return (contenderDesired && contenderCost < champCost) ? contender : currChamp;
      }, '');

      if (bestOption) {
        console.log(bestOption);
        this.actions[bestOption].action(this);
        return;
      }


      if (!bestGuess) {
        bestGuess = bestOption;
      }

      if(this.needs[trackedPriority] - this.actions[bestOption].action(this.clone()).needs[trackedPriority] <= 0) {
        bestOption = null;
      } else {
        break;
      }
    }

    console.log(this.needs);
    console.log('best guess', bestGuess, bestOption);

    if (!bestOption && !bestGuess) {
      return;
    }

    this.actions[bestOption || bestGuess].action(this);
  }
}

class Worker extends Agent {
  constructor() {
    super();

    this.avatar = ['🚶', '💃'][Math.floor(Math.random() * 2)];

    this.isAlive = true;

    this.position = new Point(0, 0);

    this.needs = {
      ...super.needs,
      health: 0,
      wealth: 0,
      hunger: 0,
    };

    this.stats = {
      ...super.stats,
      hitPoints: 100,
      cash: 50,
    };

    this.actions = {
      health: {
        // todo: this could probably be inferred from doing action result diffs
        cost: () => {
          const nearestHospital = getNearest(hospital, this.position);
          const dist = Point.Distance(this.position, nearestHospital);
          const cashAfter = (this.stats.cash - 25)
          const cashRequired = cashAfter < 0 ? Math.abs(cashAfter) : 0;

          return (dist + cashRequired);
        },
        action: (state) => {
          if (state.stats.cash < 25) {
            state.needs.wealth += clamp(state.needs.wealth + 0.15);
            return state;
          }

          const nearestHospital = getNearest(hospital, state.position);

          if (!nearestHospital) {
            console.log('no hospital');
            return state;
          }

          if (Point.Distance(state.position, nearestHospital) > 0) {
            this.moveTo(nearestHospital, state);
          } else { // if (!nearestHospital.isBusy) {
            // nearestHospital.isBusy = true;
            state.stats.hitPoints += 25;
            state.stats.cash -= 25;
            state.needs.wealth = clamp(state.needs.wealth + 0.25);
            state.needs.health = clamp(1 - (state.stats.hitPoints / 100));
            // setTimeout(()=>{ nearestHospital.isBusy = false }, 500);
          }

          return state;
        },
      },

      wealth: {
        // todo: this could probably be inferred from doing action result diffs
        cost: () => {
          const nearestWork = getNearest(work, this.position);
          const dist = Point.Distance(this.position, nearestWork);
          const healthAfter = 1 - ((this.stats.hitPoints - 5) / this.stats.hitPoints);

          return dist + healthAfter;
        },
        action: (state) => {
          if (state.stats.hitPoints <= 25) {
             state.needs.health += clamp(state.needs.health + 0.1);
             return state;
          }

          const nearestWork = getNearest(work, state.position);
          if (!nearestWork) {
            return state;
          }

          if (Point.Distance(state.position, nearestWork) > 0) {
            this.moveTo(nearestWork, state);
          } else { // if (!nearestWork.isBusy) {
            // nearestWork.isBusy = true;
            state.stats.hitPoints -= 5;
            state.needs.wealth = clamp(state.needs.wealth - 0.5);
            state.needs.health = clamp(1 - (state.stats.hitPoints / 100));
            state.stats.cash += 15;
            // setTimeout(()=>{ nearestWork.isBusy = false }, 500);
          }

          return state;
        },
      },

      hunger: {
        // todo: this could probably be inferred from doing action result diffs
        cost: () => {
          const nearestFood = getNearest(work, this.position);
          const dist = Point.Distance(this.position, nearestFood);
          const cashAfter = 1 - ((this.stats.cash - 5) / this.stats.cash);

          return dist + cashAfter;
        },
        action: (state) => {
          if (state.stats.cash <= 5) {
             state.needs.wealth += clamp(state.needs.wealth + 0.05);
             return state;
          }

          const nearestFood = getNearest(food, state.position);
          if (!nearestFood) {
            return state;
          }

          if (Point.Distance(state.position, nearestFood) > 0) {
            this.moveTo(nearestFood, state);
          } else { // if (!nearestFood.isBusy) {
            // nearestFood.isBusy = true;
            state.stats.cash -= 5;

            state.needs.wealth = clamp(state.needs.wealth + 0.05);
            state.needs.hunger = clamp(state.needs.hunger - 0.5);
            // setTimeout(()=>{ nearestFood.isBusy = false }, 500);
          }

          return state;
        },
      },
    };
  }


  moveTo(pt, state) {
    if (state.position.x < pt.x) {
      state.position.x += 1;
    }
    if (state.position.x > pt.x) {
      state.position.x -= 1;
    }
    if (state.position.y < pt.y) {
      state.position.y += 1;
    }
    if (state.position.y > pt.y) {
      state.position.y -= 1;
    }
  }

  tick() {
    if (!this.isAlive) {
      return;
    }

    this.needs.hunger += 0.0075;
    if (this.needs.hunger > 0.8) {
      this.stats.hitPoints -= 1;
    }
    if (this.needs.hunger > 0.75) {
      this.needs.hunger = clamp(this.needs.hunger + 0.1);
    }

    this.needs.health = clamp(1 - (this.stats.hitPoints / 100));
    this.isAlive = this.stats.hitPoints > 0;

    if (this.isAlive) {
      super.tick();
    } else {
      console.log('death', this.getInstinctPriorities(), this.stats, this.needs);
    }
  }
}


const workers = [];

for (let i = 0; i < 1; i += 1) {
  workers[i] = new Worker();
  workers[i].position = randomPoint();
  workers[i].stats = {
    hitPoints: 100,
    cash: Math.floor(Math.random() * 100),
  };
  workers[i].needs = {
    health: 0,
    wealth: 1 - (workers[i].stats.cash / 100),
    hunger: 0,
  };
}

const workerAtPos = (x, y) => workers.find(worker => worker.position.x === x && worker.position.y === y);
const paths = {};
const stop = false;

const render = () => {
  workers.forEach(worker => worker.tick());

  let content = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const presentWorker = workerAtPos(row, col);
      if (presentWorker) {
        paths[`${row} - ${col}`] = (paths[`${row} - ${col}`] || 0) + 1;
      }

      if (presentWorker) {
        content += presentWorker.isAlive ? presentWorker.avatar : '☠️';
      } else if (isTypeAtPoint(food, new Point(row, col))) {
        content += '🍔';
      } else if (isTypeAtPoint(work, new Point(row, col))) {
        content += '💰';
      } else if (isTypeAtPoint(hospital, new Point(row, col))) {
        content += '🏥';
      } else if (paths[`${row} - ${col}`]) {
        content += `<span style="opacity: ${paths[`${row} - ${col}`] / 100};">⬜</span>️`;
      } else {
        content += '<span style="opacity: 0">⬜</span>️';
      }
    }

    content += '<br />';
  }

  document.body.innerHTML = `<pre style="font-size: ${20 / size}vw">${content}</pre>`;

  !stop && setTimeout(render, 1000);
  // !stop && requestAnimationFrame(render);
};


render();
