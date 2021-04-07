<script>

import { afterUpdate } from 'svelte'

export let N
export let I0
export let percentage_of_cases_asymptomatic
export let D_incbation //presymptomatic_period:
export let days_from_infectious_to_not_infectious //duration_mild_infections:
export let asymptomatic_infection_duration //duration_asymp_infections:
export let icu_time_death
export let D_hospital //hospital_time_recovery:
export let beta_mild
export let beta_asymp
export let hospitalized_cases_requiring_icu_care
export let hospitalization_rate
export let death_rate_for_critical

export let R0

export let actionMarkers

let csvString = 'data:text/csv;charset=utf-8,'
afterUpdate(() => {
    csvString = 'data:text/csv;charset=utf-8,'
    csvString += 
    `Parameters

    Parameter, Value
    Population, ${N}
    Initial Infected, ${I0}
    Percentage of Asymptomatic Cases, ${percentage_of_cases_asymptomatic}
    Incubation Period Duration, ${D_incbation}
    Asymptomatic Illness Duration, ${asymptomatic_infection_duration}
    Average Hospital Duration, ${D_hospital}
    Average ICU Duration, ${icu_time_death}
    Initial Transmission Rate of Mild Cases, ${beta_mild}
    Initial Transmission Rate of Asymptomatic Cases, ${beta_asymp}
    Mild illness Infectiousness Duration, ${days_from_infectious_to_not_infectious}
    Asymptomatic Case Infectiousness Duration, ${asymptomatic_infection_duration}
    Hospitalization Rate, ${hospitalization_rate}
    Hospital to ICU Rate, ${hospitalized_cases_requiring_icu_care}
    Fatality Rate Among ICU Patients, ${death_rate_for_critical}


    Computed Values

    Computed R_0, ${R0.toFixed(2)}
    Computed CFR, ${(
        hospitalization_rate *
        hospitalized_cases_requiring_icu_care *
        death_rate_for_critical *
        (1 - percentage_of_cases_asymptomatic) *
        100
        ).toFixed(2)}


    Interventions

    Day, Name, Effect
    `
    $: actionMarkers, console.log(actionMarkers)

    actionMarkers.goh.forEach(am => {
        csvString += `${am.day}, ${am.name}, ${am.effect*100}%\r\n`
    })


    csvString += `\r\n
    Data Dictionary (Model Export Column Definitions)

    Column, Definition 
    susceptible, The number of people who could potentially be infected by the disease. On day zero this population is simply the total population less the number of initial infections; each day thereafter it is the number of people who have never been exposed. 
    asymptomatic, Cases where a person is infected but they show no symptoms. They can however infect other people. 
    infected, Mild illnesses; infections where the person is showing mild symptoms but is not severe enough to need additional care. These people can infect others.
    hospitalized, Severe illnesses; infections that have progressed to the point of needing hospital care. These people do not infect others.
    icu, Critical illesses; patients that have been moved to ICU care. These people do not infect others.
    recovered, People who have recovered from the disease and are now immunne. They cannot be re-infected.
    fatalities, People who have passed away from the disease. 
    r_0, The post-intervention R_0 value; this value will change immediately after an intervention. 
    total symptomatic, The total number of symptomatic infections; mild + severe + critical. 
    total infected, The total number of infections; this is the total symptomatic infections plus the number of asymptomatic infections.
    `


})

</script>


<a class="downloadParameters" href={encodeURI(csvString)} download="Model Parameters.csv">Download Model Parameters</a>

<style>
    .downloadParameters {
        padding: .5em 1em;
        margin-left: 1rem;
        background-color: #3273F6;
        border: 1px solid #2150ad;
        border-radius: 5px;
        color: white;
        text-decoration: none;
    }
</style>