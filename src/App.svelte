<script>
  // Libraries
  import { scaleLinear } from 'd3-scale'
  import { onMount } from 'svelte'
  import { selectAll } from 'd3-selection'
  import { drag } from 'd3-drag'
  import queryString from 'query-string'
  import { event } from 'd3-selection'
  import Icon from 'svelte-awesome'
  import { search, plus, exclamationCircle, times } from 'svelte-awesome/icons'
  import katex from 'katex'

  // Custom Svelte components
  import Chart from './components/Chart.svelte'
  import ChartCompanion from './components/ChartCompanion.svelte'
  import ActionMarker from './components/ActionMarker.svelte'
  import ParameterKnob from './components/ParameterKnob.svelte'
  import Collapsible from './components/Collapsible.svelte'
  import ExportLink from './components/ExportLink.svelte'
  import ExportParameters from './components/ExportParameters.svelte'

  // Custom utilities
  import { ActionMarkerData, AM_DAY } from './action_marker_data.js'
  import { UFState, getDefaultStateMeta } from './user_facing_states.js'
  // import // get_solution_from_gohs_seir_ode,
  // // goh_default_action_markers,
  // './models/gohs_seir_ode.js'

  import { MODEL_GOH, MODEL_CUSTOM } from './utils.js'
  import { math_inline } from './utils.js'

  // Static data imports
  import paramConfig from './paramConfig.json'
  import descriptionConfig from './descriptionConfig.json'

  // Talus Model
  import talusSEIR from './models/talusSEIRModel/model'
  import getInitial from './models/talusSEIRModel/initial'
  import getEpiParams from './models/talusSEIRModel/params'

  const descriptions = Object.entries(descriptionConfig)

  // Motivation: when we zoom out, Chart needs every nth datapoint from P.
  function get_every_nth(P, n) {
    var arr = []
    for (var i = 0; i < P.length; i += n) {
      arr.push(P[i])
    }
    return arr
  }

  let collapsed = {}

  let display_scenario_dropdown = false

  // let oneLineAttribution = `Corosim was created by <a href="https://futurice.com/" style="color: #009f77;">Futurice</a> on top of <a href="https://gabgoh.github.io/">Gabriel Goh's</a> <a href="https://gabgoh.github.io/COVID/index.html">Epidemic Calculator</a>.`

  // Initial Setup
  $: logN = Math.log(paramConfig['population'].defaultValue)
  $: N = Math.exp(logN).toFixed(0)

  $: logN, N, console.log(N, logN)

  $: I0 = paramConfig['initial_infections'].defaultValue
  $: percentage_of_cases_asymptomatic =
    paramConfig['percentage_of_cases_asymptomatic'].defaultValue

  $: R0 = 0

  // Durations
  // Incubation
  $: D_incbation =
    paramConfig['days_from_incubation_to_infectious'].defaultValue
  // Mild Infections
  $: days_from_infectious_to_not_infectious =
    paramConfig['days_from_infectious_to_not_infectious'].defaultValue
  // asymptomatic
  $: asymptomatic_infection_duration =
    paramConfig['asymptomatic_infection_duration'].defaultValue
  // hospitalized duration
  $: D_hospital = paramConfig['days_in_hospital'].defaultValue
  // ICU duration
  $: icu_time_death = paramConfig['icu_time_death'].defaultValue

  // Class transition rates
  // mild to hospitalized
  $: hospitalization_rate = paramConfig['hospitalization_rate'].defaultValue
  // hospital to icu
  $: hospitalized_cases_requiring_icu_care =
    paramConfig['hospitalized_cases_requiring_icu_care'].defaultValue
  // icu to dead
  $: death_rate_for_critical =
    paramConfig['death_rate_for_critical'].defaultValue

  $: death_rate_for_critical, console.log(death_rate_for_critical)

  // Transmission
  // Mild Infection
  $: beta_mild = paramConfig['beta_mild'].defaultValue
  // Asymptomatic
  $: beta_asymp = paramConfig['beta_asymp'].defaultValue
  // Hospitalized
  $: beta_hospitalized = 0 // paramConfig['beta_hospitalized'].defaultValue
  // ICU
  $: beta_icu = 0 // paramConfig['beta_icu'].defaultValue

  $: Time = 220
  $: Xmax = 110000
  $: dt = 8
  $: icuCapacity = 0 // paramConfig['icu_capacity'].defaultValue

  // $: dt, console.log(dt)

  $: policyRampDays = 0 // paramConfig.policyRampDays.defaultValue
  $: logisticRamp = true

  const onChange_P_SEVERE = e => {
    const eventValue = Number(e.target.value)
    if (eventValue > CFR) {
      // P_SEVERE = eventValue
    } else {
      // P_SEVERE = 0 // to force update
      // setTimeout(() => (P_SEVERE = CFR), 0)
    }
  }

  const onChangeCFR = e => {
    const eventValue = Number(e.target.value)
    const change = eventValue - CFR
    // const newValue = P_SEVERE + change
    const max = paramConfig['hospitalization_rate'].maxValue

    // P_SEVERE = newValue < max ? newValue : max
    CFR = eventValue
  }

  function toggleZoomStates() {
    dt *= 2
    if (dt > 8) dt = 2
  }

  function closePopup() {
    popupHTML = ''
  }

  function addActionMarker() {
    actionMarkers[selectedModel].push(
      new ActionMarkerData(99 * dt, undefined, -0.1, true)
    )
    actionMarkers = actionMarkers // Trigger re-render
  }

  function with_enough_days(P, dt) {
    var augmented = []
    for (var i = 0; i < P.length; i++) {
      augmented.push(P[i])
    }
    // If we have too few values, augment with empty so that the Chart renders properly.
    while (augmented.length < 101 * dt) {
      augmented.push(new UFState(0, 0, 0, 0, 0, 0))
    }
    return augmented
  }

  function take_slice_from_beginning(P, dt) {
    var augmented = []
    for (var i = 0; i < P.length; i++) {
      augmented.push(P[i])
    }
    // If we have too many values, take desired slice from the beginning.
    augmented = augmented.slice(0, 101 * dt)
    return augmented
  }

  function getPmax(P_bars, states) {
    var Pmax = 0
    for (var i = 0; i < P_bars.length; i++) {
      const bars = P_bars[i]
      var curr = 0
      for (var j = 0; j < states.length; j++) {
        const state = states[j]
        if (state['checked']) {
          const k = state['key']
          curr += P_bars[i][k]
        }
      }
      if (curr > Pmax) {
        Pmax = curr
      }
    }
    return Pmax
  }

  /* Generate state (choose which model to run, run it with user specified parameters, etc.) */

  function debugHelper([...vars]) {
    if (vars.length == 0) return
    console.log('*** DEBUG ***')
    for (var i = 0; i < vars.length; i++) {
      console.log(vars[i])
    }
  }

  function get_solution(
    selectedModel,
    P_all_fetched,
    actionMarkers,
    goh_states_fin,
    dt,
    N,
    I0,
    D_incbation,
    percentage_of_cases_asymptomatic,
    duration_asymp_infections,
    days_from_infectious_to_not_infectious,
    hospital_time_recovery,
    icu_time_death,
    beta_mild,
    beta_asymp,
    beta_hospitalized,
    beta_icu,
    hospitalized_cases_requiring_icu_care,
    hospitalization_rate,
    death_rate_for_critical,
    policyRampDays,
    logisticRamp

    // D_infectious,
    // D_recovery_mild,
    // D_hospital,
    // P_SEVERE,
    // P_ICU,
    // CFR
  ) {
    if (selectedModel === MODEL_GOH) {
      // var start = performance.now()

      // const solution = get_solution_from_gohs_seir_ode(
      //   actionMarkers[selectedModel],
      //   goh_states_fin,
      //   tmax,
      //   N,
      //   I0,
      //   R0,
      //   D_incbation,
      //   D_infectious,
      //   D_recovery_mild,
      //   D_hospital,
      //   P_SEVERE,
      //   P_ICU,
      //   CFR
      // )

      // console.log(actionMarkers[selectedModel])

      console.log(death_rate_for_critical)

      const initial = getInitial({
        // days_to_model: 101 * dt,
        days_to_model: 101 * 8,
        population: N,
        exposed: I0,
        percentage_of_cases_asymptomatic,
        presymptomatic_period: D_incbation,
        duration_mild_infections: days_from_infectious_to_not_infectious,
        duration_asymp_infections: asymptomatic_infection_duration,
        icu_time_death,
        hospital_time_recovery: D_hospital,
        beta_mild,
        beta_asymp,
        beta_hospitalized,
        beta_icu,
        hospitalized_cases_requiring_icu_care,
        hospitalization_rate,
        death_rate_for_critical,
        policyRampDays,
        logisticRamp,
      })
      console.log(initial)

      const epiParams = getEpiParams(initial)

      const interventions = actionMarkers[selectedModel].map(am => ({
        day: am.day,
        effect: am.effect * -1,
      }))

      const talusSolution = talusSEIR({
        interventions,
        epiParams,
        initial,
      })

      // var end = performance.now()
      // var duration = end - start
      // console.log(duration)

      console.log(`talus r0 ${talusSolution.r0}`)

      R0 = talusSolution.r0

      return talusSolution.days
    } else if (selectedModel === MODEL_CUSTOM) {
      return P_all_fetched
    } else {
      console.log(
        'Error! getSolution does not have handling for model ',
        selectedModel
      )
    }
  }

  function actionMarkerHelper() {
    const m = actionMarkers || {}
    if (!m[MODEL_GOH]) {
      // Action markers for Goh have not been set yet; set to default values.
      m[MODEL_GOH] = [
        // new ActionMarkerData(45, 'Initial Lockdown', -0.7),
        new ActionMarkerData(110, 'Initial Lockdown', -0.7),
        new ActionMarkerData(218, 'Reopening', 0.8),
        new ActionMarkerData(251, 'Renewed Caution', -0.2),
        new ActionMarkerData(512, 'Tired of Lockdown', 0.3),
      ]
    }
    return m
  }

  let customScenarioGUID = queryString.parse(location.search).customScenario
  let P_all_fetched = [] // For "Custom scenario": empty array until we get data.

  $: selectedModel = customScenarioGUID ? MODEL_CUSTOM : MODEL_GOH
  $: goh_states_fin = []

  $: goh_states_fin, console.log(goh_states_fin)

  $: actionMarkers = actionMarkerHelper()
  $: stateMeta = getDefaultStateMeta()

  $: P_SEVERE = paramConfig['hospitalization_rate'].defaultValue
  $: P_ICU = paramConfig['hospitalized_cases_requiring_icu_care'].defaultValue

  $: death_rate_for_critical, console.log(death_rate_for_critical)

  $: P_all_future = get_solution(
    selectedModel,
    P_all_fetched,
    actionMarkers,
    goh_states_fin,
    dt,
    N,
    I0,
    D_incbation,
    percentage_of_cases_asymptomatic,
    asymptomatic_infection_duration,
    days_from_infectious_to_not_infectious,
    D_hospital,
    icu_time_death,
    beta_mild,
    beta_asymp,
    beta_hospitalized,
    beta_icu,
    hospitalized_cases_requiring_icu_care,
    hospitalization_rate,
    death_rate_for_critical,
    policyRampDays,
    logisticRamp
    // D_infectious,
    // D_recovery_mild,
    // D_hospital,
    // P_SEVERE,
    // P_ICU,
    // CFR
  )
  // $: P_all            = with_enough_days(P_all_historical.concat(P_all_future), dt)
  $: P_all = with_enough_days(P_all_future, dt)
  $: P_bars = get_every_nth(take_slice_from_beginning(P_all, dt), dt)
  $: timestep = dt
  $: tmax = dt * 101
  $: Pmax = getPmax(P_bars, stateMeta)
  $: lock = false
  $: debugHelp = debugHelper([])
  $: flashMessage = ''
  $: popupHTML = ''

  var Plock = 1

  var drag_y = function () {
    var dragstarty = 0
    var Pmaxstart = 0

    var dragstarted = function (d) {
      dragstarty = event.y
      Pmaxstart = Pmax
    }

    var dragged = function (d) {
      Pmax = Math.max(Pmaxstart * (1 + (event.y - dragstarty) / 500), 10)
    }

    return drag().on('drag', dragged).on('start', dragstarted)
  }

  var drag_x = function () {
    var dragstartx = 0
    var dtstart = 0
    var Pmaxstart = 0
    var dragstarted = function (d) {
      dragstartx = event.x
      dtstart = dt
      Plock = Pmax
      lock = true
    }
    var dragged = function (d) {
      dt = dtstart - 0.0015 * (event.x - dragstartx)
    }
    var dragend = function (d) {
      lock = false
    }
    return drag()
      .on('drag', dragged)
      .on('start', dragstarted)
      .on('end', dragend)
  }

  $: parsed = ''
  onMount(async () => {
    if (customScenarioGUID) {
      fetchCustomScenarioAsync()
    }

    var drag_callback_y = drag_y()
    drag_callback_y(selectAll('#yAxisDrag'))
  })

  function lock_yaxis() {
    Plock = Pmax
    lock = true
  }

  function unlock_yaxis() {
    lock = false
  }

  let width = 750
  let height = 400

  $: indexToTime = scaleLinear().domain([0, P_bars.length]).range([0, tmax])

  window.addEventListener('mouseup', unlock_yaxis)

  function activeHelper(active) {
    if (active >= 0) {
      // Case: User hovers over a bar or has locked a bar.
      return active
    }
    return Math.min(100)
  }

  $: active = 0
  $: active_ = activeHelper(active)

  var Tinc_s = '\\color{#CCC}{T^{-1}_{\\text{inc}}} '
  var Tinf_s = '\\color{#CCC}{T^{-1}_{\\text{inf}}}'
  var Rt_s = '\\color{#CCC}{\\frac{\\mathcal{R}_{t}}{T_{\\text{inf}}}} '
  $: ode_eqn = katex.renderToString(
    '\\frac{d S}{d t}=-' +
      Rt_s +
      '\\cdot IS,\\qquad \\frac{d E}{d t}=' +
      Rt_s +
      '\\cdot IS- ' +
      Tinc_s +
      ' E,\\qquad \\frac{d I}{d t}=' +
      Tinc_s +
      'E-' +
      Tinf_s +
      'I, \\qquad \\frac{d R}{d t}=' +
      Tinf_s +
      'I',
    {
      throwOnError: false,
      displayMode: true,
      colorIsTextColor: true,
    }
  )

  // $: p_num_ind = 40

  function get_icu_peak(P) {
    function argmax(k) {
      var maxVal = 0
      var maxValIndex = 0
      for (var i = 0; i < P.length; i += 1) {
        const val = P[i][k]
        if (val > maxVal) {
          maxVal = val
          maxValIndex = i
        }
      }
      return maxValIndex
    }

    const peakICUDay = argmax('icu')
    const peakICUCount = Math.round(P[peakICUDay]['icu'])
    return [peakICUDay, peakICUCount]
  }

  $: [peakICUDay, peakICUCount] = get_icu_peak(P_all)
  $: log = true
</script>

<link rel="stylesheet" href="katex.css" />

<header>
  <div class="titlesection">
    <h2>Talus Analytics SEIR Model</h2>
    <h3>SEIR Model with Hospitalizations, ICU, and Asymptomatic infections</h3>
  </div>
  <!-- <div class="legendtext" style="">
    <b class="outcomeHeader">Scenario Results</b>
    <span style="text-align: left;">
      <ul class="outcomeList">
        <li>
          {P_all[P_all.length - 2]['fatalities']} fatalities in first
          {P_all.length} days.
        </li>
        {#if peakICUDay < P_all.length - 50}
          <li>Peak ICU on {peakICUDay}.</li>
          <li>{peakICUCount} ICU patients at peak.</li>
        {:else}
          <li>Peak possibly not reached!</li>
        {/if}
        <li>
          {Math.round((100 * P_all[P_all.length - 1]['susceptible']) / N)}%
          remain susceptible.
        </li>
      </ul>
    </span>
  </div> -->
</header>

<div class="mobileWarning">
  <h3>
    Sorry! This web app is not optimized for a mobile experience or small
    screens. If you can, please come back on a desktop device.
  </h3>
</div>

<div class="chart" style="display: flex; max-width: 1200px">
  <div style="flex: 0 0 300px; width:300px;">
    <!-- ChartCompanion (scenario outcome and highlighted day, left side of chart). -->
    <div style="position:relative; top: 100px; right:-115px">
      <ChartCompanion
        bind:stateMeta
        {N}
        {dt}
        {P_all}
        {P_bars}
        {active_}
        {indexToTime}
        {peakICUDay}
        {peakICUCount}
      />
    </div>
  </div>

  <div
    style="flex: 0 0 890px; width:890px; height: {height +
      128}px; position:relative;"
  >
    <!-- Flash message to help the user understand why some action was not possible. -->
    <div
      on:click={() => {
        flashMessage = ''
      }}
      style="position: absolute;
                left: 400px;
                top: -70px;
                width: 700px;
                cursor: pointer;
                color: #f0027f;
                opacity: 0.5;
                visibility: {flashMessage !==
      ''
        ? 'visible'
        : 'hidden'};
                font-size: 16px;
                "
    >
      <Icon
        data={exclamationCircle}
        scale="1.5"
        style="color: #f0027f; position: absolute; cursor: pointer;"
      />
      <span style="position: absolute; left: 30px; top: 3px;">
        {flashMessage}
      </span>
    </div>

    <div style="position:relative; top:60px; left: 10px">
      <!-- The actual chart with bars and stuff. -->
      <Chart
        bind:active
        states={P_bars}
        {stateMeta}
        xmax={Xmax}
        {timestep}
        {tmax}
        {N}
        ymax={lock ? Plock : Pmax}
        {selectedModel}
        {icuCapacity}
        log={!log}
      />

      <!-- Buttons on thee right side of chart: zoom and add. -->
      <div>
        {#if selectedModel === MODEL_GOH}
          <div on:click={addActionMarker} title="Add new action marker">
            <Icon
              data={plus}
              scale="2.5"
              class="clickableIcons"
              style="color: #CCC; position: absolute; right: 70px; top: 20px;"
            />
          </div>
        {/if}
        <div on:click={toggleZoomStates} title="Zoom">
          <Icon
            data={search}
            scale="2.5"
            class="clickableIcons"
            style="color: #CCC; position: absolute; right: 70px; bottom: 0px;"
          />
        </div>
      </div>
    </div>

    <!-- Y axis zoom. -->
    <div
      id="yAxisDrag"
      style="cursor:row-resize;
                pointer-events: all;
                position: absolute;
                top:{55}px;
                left:{0}px;
                width:{20}px;
                background-color:#222;
                opacity: 0;
                height:425px;"
    />

    <!-- Action Markers. -->
    {#each actionMarkers[selectedModel] as actionMarkerData}
      {#if actionMarkerData[AM_DAY] < tmax}
        <ActionMarker
          {width}
          {height}
          {R0}
          {tmax}
          {Pmax}
          {P_all}
          bind:allActiveActionMarkers={actionMarkers[selectedModel]}
          bind:actionMarkerData
          bind:Plock
          bind:lock
          bind:lock_yaxis
          bind:flashMessage
        />
      {/if}
    {/each}
  </div>
</div>
<!-- 
<p class="center">
  <b>Parameter configuration</b>
</p> -->

<!-- Large popup when user clicks a question mark icon. -->
{#if popupHTML !== ''}
  <div class="center" style="padding-bottom: 0px;">
    <div
      style="position: absolute; width: 950px; background-color: white; border: 1px solid #CCC; border-radius: 5px; z-index: 999999;"
    >
      <div on:click={closePopup} title="Close">
        <Icon
          data={times}
          scale="3"
          class="clickableIcons"
          style="color: #CCC; position: absolute; right: 20px; top: 20px;"
        />
      </div>
      <div
        style="position: relative;
                  top: 20px;
                  padding-bottom: 20px;
                  left: 50px;
                  width: 85%;
                  font-weight: 300;
                  color:#666;
                  font-size: 16.5px;
                  text-align: justify;
                  line-height: 24px"
      >
        {@html popupHTML}
        <button
          on:click={closePopup}
          style="color: #666; font-size: 20px; cursor: pointer; padding: 10px; background: none; border: 1px solid #CCC;"
          ><b>OK</b></button
        >
        <br /><br />
      </div>
    </div>
  </div>
{/if}


<Collapsible title="Basic Parameters" bind:collapsed defaultCollapsed={false}>
  <div>
    <div class="row">
      <div class="column">
        <ParameterKnob
          p={paramConfig['population']}
          bind:displayOverrideValue={N}
          bind:value={logN}
          bind:popupHTML
        />
        <ParameterKnob
          p={paramConfig['initial_infections']}
          bind:value={I0}
          bind:popupHTML
        />
      </div>
      <div class="column">
        <ParameterKnob
          p={paramConfig['percentage_of_cases_asymptomatic']}
          bind:value={percentage_of_cases_asymptomatic}
          bind:popupHTML
        />
        <ParameterKnob
          p={paramConfig['days_from_incubation_to_infectious']}
          bind:value={D_incbation}
          bind:popupHTML
        />
      </div>
      <div class="column">
        <ParameterKnob
          p={paramConfig['days_in_hospital']}
          bind:value={D_hospital}
          bind:popupHTML
        />
        <ParameterKnob
          p={paramConfig['icu_time_death']}
          bind:value={icu_time_death}
          bind:popupHTML
        />
      </div>
    </div>
  </div>
</Collapsible>

<Collapsible title="Transmission Rates" bind:collapsed defaultCollapsed={false}>
  <div>
    <div class="row">
      <div class="column">
        <ParameterKnob
          p={paramConfig['beta_mild']}
          bind:value={beta_mild}
          bind:popupHTML
        />
        <ParameterKnob
          p={paramConfig['beta_asymp']}
          bind:value={beta_asymp}
          bind:popupHTML
        />
      </div>
      <div class="column">
        <ParameterKnob
          p={paramConfig['days_from_infectious_to_not_infectious']}
          bind:value={days_from_infectious_to_not_infectious}
          bind:popupHTML
        />
        <ParameterKnob
          p={paramConfig['asymptomatic_infection_duration']}
          bind:value={asymptomatic_infection_duration}
          bind:popupHTML
        />
      </div>
      <!-- <div class="column">
        <ParameterKnob
          p={paramConfig['beta_hospitalized']}
          bind:value={beta_hospitalized}
          bind:popupHTML
        />
        <ParameterKnob
          p={paramConfig['beta_icu']}
          bind:value={beta_icu}
          bind:popupHTML
        />
      </div> -->
      <div class="column">
        <h5>Computed {@html math_inline('\\mathcal{R}_0')} {R0.toFixed(2)}</h5>
        <p>
          The initial transmission rate is a function of the asymptomatic and
          symptomatic transmission rates and durations through each stage of the
          disease.
        </p>
      </div>
    </div>
  </div>
</Collapsible>

<Collapsible
  title="Disease & Treatment Progression"
  bind:collapsed
  defaultCollapsed={false}
>
  <div>
    <div class="row">
      <div class="column">
        <ParameterKnob
          p={paramConfig['hospitalization_rate']}
          bind:value={hospitalization_rate}
          bind:popupHTML
        />
        <ParameterKnob
          p={paramConfig['hospitalized_cases_requiring_icu_care']}
          bind:value={hospitalized_cases_requiring_icu_care}
          bind:popupHTML
        />
      </div>
      <div class="column">
        <ParameterKnob
          p={paramConfig['death_rate_for_critical']}
          bind:value={death_rate_for_critical}
          bind:popupHTML
        />
        <!-- <ParameterKnob
          p={paramConfig.policyRampDays}
          bind:value={policyRampDays}
          bind:dlfkjsdopupHTML
        />
        <label
          ><input type="checkbox" bind:checked={logisticRamp} /> Use Logistic Ramp</label
        > -->
      </div>
      <div class="column">
        <h5>
          Computed CFR: {(
            hospitalization_rate *
            hospitalized_cases_requiring_icu_care *
            death_rate_for_critical *
            (1 - percentage_of_cases_asymptomatic) *
            100
          ).toFixed(2)}%
        </h5>
        <p>
          The case fataility rate is a factor of the proportion of cases which
          are symptomatic, hospitalization rate, ICU Admission rate, and ICU
          fatality rate.
        </p>
      </div>
    </div>
  </div>
</Collapsible>

<div class="row">

<ExportLink P_all={P_all}/>
<ExportParameters {...{
    N,
    I0,
    percentage_of_cases_asymptomatic,
    D_incbation,
    days_from_infectious_to_not_infectious,
    asymptomatic_infection_duration,
    icu_time_death,
    D_hospital,
    beta_mild,
    beta_asymp,
    hospitalized_cases_requiring_icu_care,
    hospitalization_rate,
    death_rate_for_critical,
    R0,
    actionMarkers,
  }} />
</div>

<div class="bottomPadding" />

<style>
  @font-face {
    font-family: 'Liberation Sans';
    font-style: normal;
    font-weight: normal;
    font-display: swap;
    src: url(fonts/LiberationSans-Regular.ttf) format('truetype');
  }

  @font-face {
    font-family: 'Liberation Sans';
    font-style: normal;
    font-weight: bold;
    font-display: swap;
    src: url(fonts/LiberationSans-Bold.ttf) format('truetype');
  }

  @font-face {
    font-family: 'Liberation Sans';
    font-style: italic;
    font-weight: normal;
    font-display: swap;
    src: url(fonts/LiberationSans-Italic.ttf) format('truetype');
  }

  @font-face {
    font-family: 'Liberation Sans';
    font-style: italic;
    font-weight: bold;
    font-display: swap;
    src: url(fonts/LiberationSans-BoldItalic.ttf) format('truetype');
  }

  :global(html) {
    overflow-y: scroll;
    font-family: 'Liberation Sans';
  }

  header {
    margin: 3rem auto 6rem auto;
    max-width: 1200px;
    display: flex;
    align-items: flex-end;
    color: #555;
  }

  .titlesection {
    flex-grow: 1;
  }

  h2 {
    font-size: 40px;
    font-weight: 300;
  }

  h4 {
    font-size: 18px;
    width: 100%;
    border-bottom: 1px solid #ddd;
    padding-bottom: 5px;
    color: #555;
  }

  .center {
    margin: auto;
    width: 950px;
    padding-bottom: 20px;
    font-weight: 300;
    color: #666;
    font-size: 16.5px;
    text-align: justify;
    line-height: 24px;
  }

  .row {
    position: relative;
    margin-top: 1rem;
    padding-top: 2rem;
    margin: auto;
    display: flex;
    /* width: 948px; */
    width: 1180px;
    max-width: 90vw;
    font-size: 13px;
  }
  .row::before {
    position: absolute;
    content: '';
    top: 1rem;
    left: 0;
    right: 0;
    height: 1px;
    width: 100%;
    background-color: #ddd;
  }

  .column {
    flex: 158px;
    /* width: auto; */
    /* flex-shrink: 1; */
    padding: 0px 15px 15px 0px;
    margin: 0px 5px 5px 5px;
  }

  .column > h5 {
    margin-top: 0;
    margin-bottom: 0.5em;
    font-size: 1.2rem;
    color: #666;
  }

  .column > p {
    line-height: 1.4;
    /* font-size: 1.2em; */
    color: #666;
  }

  .paneltext {
    position: relative;
  }

  .paneldesc {
    color: #888;
    text-align: left;
    font-weight: 300;
  }

  .chart {
    width: 100%;
    margin: 0 auto;
    padding-top: 0px;
    padding-bottom: 10px;
  }

  /* TODO should be moved to global.css because this is copypasted into 3 components. */
  .legendtext {
    color: #888;
    font-size: 13px;
    padding-bottom: 5px;
    font-weight: 300;
    line-height: 14px;
  }

  :global(.clickableIcons:hover) {
    cursor: pointer;
    color: #777 !important;
  }

  @media screen and (max-width: 1199px) {
    .mobileWarning {
      margin-top: 0px;
      margin-bottom: 40px;
    }
  }

  @media screen and (min-width: 1200px) {
    .mobileWarning {
      visibility: hidden;
      position: absolute;
    }
  }

  .bottomPadding {
    height: 10rem;
  }
</style>
