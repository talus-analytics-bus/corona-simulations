
const getEpiParams = model_run => {

    const eP = {}

    eP.N = model_run.population

    eP.fraction_critical = (
        (1 - model_run.percent_asymp)
        * model_run.hospitalization_rate
        * model_run.hospitalized_cases_requiring_icu_care
    )

    eP.alpha = 1 / model_run.presymptomatic_period

    eP.beta = [
        0,
        model_run.beta_mild / eP.N,
        model_run.beta_hospitalized / eP.N,
        model_run.beta_icu / eP.N,
        // TODO move beta.A to model params
        model_run.beta_mild / eP.N,
    ]

    eP.beta_mild = model_run.beta_mild
    eP.beta_asymp = model_run.beta_asymp

    eP.beta_A = model_run.beta_mild / eP.N

    // have to calculate these in order and then put them into arrays
    eP.gamma_0 = 0
    eP.gamma_1 = (1 / model_run.duration_mild_infections) * (1 - model_run.hospitalization_rate)
    eP.rho_0 = 0
    eP.rho_1 = (1 / model_run.duration_mild_infections) - eP.gamma_1
    eP.rho_2 = (1 / model_run.hospital_time_recovery) * (eP.fraction_critical / model_run.hospitalization_rate)

    eP.gamma_2 = (1 / model_run.hospital_time_recovery) - eP.rho_2

    eP.mu = (1 / model_run.icu_time_death) * (model_run.case_fatality_rate / eP.fraction_critical)

    eP.gamma_3 = (1 / model_run.icu_time_death) - eP.mu

    // TODO move gamma_a to model params
    eP.gamma_A = eP.gamma_1

    eP.gamma = [
        eP.gamma_0,
        eP.gamma_1,
        eP.gamma_2,
        eP.gamma_3,
        eP.gamma_A,
    ]

    // "gamma": L(gamma_0, gamma_1, gamma_2, gamma_3, A = 0),
    eP.rho = [
        eP.rho_0,
        eP.rho_1,
        eP.rho_2
    ]

    eP.f = model_run.percent_asymp

    // these are used to get the growth-rate-base R estimation
    // Serial interval =[Incubation Period]+1/2[Duration of mild infection]
    eP.serial_interval = model_run.presymptomatic_period + (model_run.duration_mild_infections / 2)

    // f = Ratio of mean infectious period to mean serial interval
    eP.f_ratio = (model_run.duration_mild_infections / 2) / eP.serial_interval

    // r0, given initial conditions and epi parameters
    eP.r0 = model_run.population * (
        ((eP.beta[1]) / (eP.rho[1] + eP.gamma[1]))
        + (eP.rho[1] / (eP.rho[1] + eP.gamma[1]))
        * (eP.beta[2] / (eP.rho[2] + eP.gamma[2])
            + (eP.rho[2] / (eP.rho[2] + eP.gamma[2]))
            * (eP.beta[3] / (eP.mu + eP.gamma[3]))))

    return eP
}

export default getEpiParams