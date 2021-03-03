
const getInitial = ({
    days_to_model,
    population,
    exposed,
    presymptomatic_period,
    duration_asymp_infections,
    percentage_of_cases_asymptomatic,
    duration_mild_infections,
    hospital_time_recovery,
    icu_time_death,
    beta_mild,
    beta_asymp,
    beta_hospitalized,
    beta_icu,
    hospitalized_cases_requiring_icu_care,
    hospitalization_rate,
    death_rate_for_critical,
}) => {

    const initial = {
        days_to_model,
        stepDays: 1,
        population,
        exposed,
        presymptomatic_period,
        duration_asymp_infections,
        duration_mild_infections,
        hospital_time_recovery,
        icu_time_death,
        beta_mild,
        beta_asymp,
        beta_hospitalized,
        beta_icu,
        hospitalized_cases_requiring_icu_care,
        hospitalization_rate,
        death_rate_for_critical,
        mild: 0,
        hospitalized: 0,
        icu: 0,
        recovered: 0,
        dead: 0,
        asymp: 0,
    }

    // do we need different size steps?
    // initial.stepDays = 1

    // define constants used in model parameter calculations
    // initial.observed_daily_growth_rate = 1.17

    // when going back to test hypothetical intervnetions in the past,
    // use this to start the data from this date instead of latest reported
    initial.override_model_start = false

    // Variables for calculating model parameters Hill -> our names/calcs
    // IncubPeriod: Average incubation period, days - presymptomatic_period
    // DurMildInf: Average duration of mild infections, days - duration_mild_infections
    // FracMild: Average fraction of (symptomatic) infections that are mild - (1 - hospitalization_rate)
    // FracSevere: Average fraction of (symptomatic) infections that are severe - hospitalization_rate * hospitalized_cases_requiring_icu_care
    // FracCritical: Average fraction of (symptomatic) infections that are critical - hospitalization_rate * hospitalized_cases_requiring_icu_care
    // CFR: Case fatality rate (fraction of infections that eventually result in death) - case_fatality_rate
    // DurHosp: Average duration of hospitalization (time to recovery) for individuals with severe infection, days - hospital_time_recovery
    // TimeICUDeath: Average duration of ICU admission (until death or recovery), days - icu_time_death

    // LOGIC ON INITIAL CONDITIONS:
    // hospitalized = case load from timeseries on last day of data / 4
    // mild = hospitalized / hospitalization_rate
    // icu = hospitalized * hospitalized_cases_requiring_icu_care
    // expoosed = exposed_infected_ratio * mild

    // Time before exposed are infectious (days)
    // initial.presymptomatic_period = 6

    // Time mildly infected people stay sick before
    // hospitalization or recovery (days)
    // initial.duration_mild_infections = days_from_infectious_to_not_infectious //6 

    // Time asymptomatically infected people stay
    // infected before recovery (days)
    // initial.duration_asymp_infections = 6

    // Duration of hospitalization before icu or
    // recovery (days)
    // initial.hospital_time_recovery = 11

    // Time from ICU admission to death (days)
    // initial.icu_time_death = days_in_icu


    // BETA: transmission rate (new cases per day).
    // The rate at which infectious cases of various
    // classes cause secondary or new cases.

    //
    // Transmission rate of infected people with no
    // symptoms [A] (new cases per day)
    // This is really beta * N, but it's easier to talk about this way
    // Default: 0.6
    // Current: Calculated based on observed doubling
    // rates
    //initial.beta_asymp = 0.3 + ((initial.observed_daily_growth_rate - 1.09) / 0.02) * 0.05
    // initial.beta_asymp = 0.4
    //
    // Transmission rate of infected people with mild
    // symptoms [I_1] (new cases per day)
    // This is really beta * N, but it's easier to talk about this way
    // Default: 0.6
    // Current: Calculated based on observed doubling
    // rates
    //initial.beta_mild = 0.3 + ((initial.observed_daily_growth_rate - 1.09) / 0.02) * 0.05
    // initial.beta_mild = 0.4
    //
    // Transmission rate of infected people with severe
    // symptoms [I_2] (new cases per day)
    // This is really beta * N, but it's easier to talk about this way
    // Default: 0.1
    // initial.beta_hospitalized = 0.1
    //
    // Transmission rate of infected people with severe
    // symptoms [I_3] (new cases per day)
    // This is really beta * N, but it's easier to talk about this way
    // Default: 0.1
    // initial.beta_icu = 0.1
    //
    //////////////////////////////////

    // Pecentage of asymptomatic, infectious [A] people
    // out of all those who are infected
    // make 0 to remove this stock
    initial.percent_asymp = percentage_of_cases_asymptomatic

    initial.percent_infectious_symptomatic = 1 - initial.percent_asymp

    // initial.hospitalization_rate = 0.10
    // initial.hospitalization_rate = 0.15
    // initial.hospitalized_cases_requiring_icu_care = 0.25

    initial.percent_symptomatic_mild =
        initial.percent_infectious_symptomatic - initial.hospitalization_rate

    // changed this from CFR to make the calc of mu clearer
    // initial.death_rate_for_critical = 0.38

    // CFR is calculated from the input parameters vs. fixed
    initial.case_fatality_rate = (
        (1 - initial.percent_asymp)
        * initial.hospitalization_rate
        * initial.hospitalized_cases_requiring_icu_care
        * initial.death_rate_for_critical
    )

    // if true we calculatied the exposed initial stock 
    // from the infected number vs. leaving it at 0
    initial.exposed_from_infected = true
    initial.exposed_infected_ratio = 1

    // different ways to model the actual data

    // cases represent all infected symptomatic
    // based on proportion of mild/hospitalized/icu
    // described in params
    // initial.model_cases = "divided_into_infected"

    // 1/4 cases are hopsitalized, mild and icu
    // based on proporition of hopsitalized
    // described in params
    // initial.model_cases = "one_in_4_hospitalized"

    initial.hospital_capacity_change_daily_rate = 1.05
    initial.max_hospital_capacity_factor = 2.07
    initial.initial_hospital_bed_utilization = 0.6

    initial.case_fatality_rate_hospitals_overwhelmed =
        initial.hospitalization_rate * initial.hospitalized_cases_requiring_icu_care

    return initial
}

export default getInitial