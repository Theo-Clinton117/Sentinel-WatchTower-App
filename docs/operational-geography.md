# Operational Geography

Sentinel should model Nigeria as a hierarchy instead of treating each state as one operating unit. The hierarchy keeps national analytics simple while still supporting local dispatch, patrol planning, pricing, and incident clustering.

## Target Hierarchy

```text
Nigeria
  -> Geopolitical Zone
  -> State
  -> Sentinel Operational Zone
  -> Response Grid
```

## Level 1: National Geopolitical Zones

Use the six national geopolitical zones for high-level analytics and risk reporting.

| Zone | States |
| --- | --- |
| North Central | Benue, Kogi, Kwara, Nasarawa, Niger, Plateau, FCT |
| North East | Adamawa, Bauchi, Borno, Gombe, Taraba, Yobe |
| North West | Jigawa, Kaduna, Kano, Katsina, Kebbi, Sokoto, Zamfara |
| South East | Abia, Anambra, Ebonyi, Enugu, Imo |
| South South | Akwa Ibom, Bayelsa, Cross River, Delta, Edo, Rivers |
| South West | Ekiti, Lagos, Ogun, Ondo, Osun, Oyo |

## Level 2: State Operational Zones

Each state should be divided into 3 to 8 Sentinel Operational Zones. Zone boundaries should account for:

- Population density
- Number of LGAs
- Crime patterns
- Road networks
- Emergency response times
- Urban and rural distribution

### Rivers State

| Zone | LGAs |
| --- | --- |
| Port Harcourt Metro | Port Harcourt, Obio-Akpor |
| Western Rivers | Degema, Asari-Toru, Akuku-Toru |
| Northern Rivers | Ikwerre, Emohua, Etche |
| Eastern Rivers | Ogu/Bolo, Okrika, Eleme, Tai |
| Ogoni Axis | Khana, Gokana |
| South-East Rivers | Andoni, Opobo/Nkoro, Oyigbo |

### Lagos State

| Zone | LGAs |
| --- | --- |
| Lagos Island | Lagos Island, Lagos Mainland |
| Ikeja Metro | Ikeja, Oshodi-Isolo, Mushin |
| Lekki Corridor | Eti-Osa, Ibeju-Lekki |
| Badagry Axis | Badagry, Ojo |
| Ikorodu Axis | Ikorodu |
| Agege Axis | Agege, Ifako-Ijaiye |
| Alimosho Axis | Alimosho |

### Kano State

| Zone | LGAs |
| --- | --- |
| Kano Metro | Kano Municipal, Fagge, Tarauni, Dala, Gwale |
| North Kano | Kunchi, Makoda, Dawakin Tofa |
| South Kano | Bebeji, Rano, Kibiya |
| East Kano | Gaya, Ajingi, Albasu |
| West Kano | Karaye, Rogo |

## Level 3: Response Grids

Inside each operational zone, divide the area into smaller response grids. Grids may be fixed-size cells, such as 5 km by 5 km, or neighborhood-based cells where urban density makes named areas more useful.

Example for Port Harcourt Metro:

```text
Port Harcourt Metro
  -> GRA
  -> D-Line
  -> Rumuola
  -> Rumuokoro
  -> Woji
  -> Old GRA
  -> Trans Amadi
  -> Borokiri
  -> Mile 1
  -> Mile 3
```

Response grids support:

- Faster dispatch calculations
- Heat maps
- Patrol optimization
- Incident clustering
- Dynamic pricing based on local risk

## Implementation Notes

The current `risk_zones` table stores flat circular risk areas with `name`, `center_lat`, `center_lng`, `radius_m`, and `risk_level`. A future nationwide rollout should separate administrative geography from dynamic risk overlays.

Implemented model direction:

- `geopolitical_zones`: stable national zones.
- `states`: state and FCT records linked to geopolitical zones.
- `operational_zones`: Sentinel-defined service zones linked to states.
- `response_grids`: dispatch and pricing cells linked to operational zones.
- `risk_zones`: dynamic risk overlays linked to a response grid or operational zone when possible.

The backend exposes this hierarchy at `GET /risk-zones/geography`. The existing `GET /risk-zones` endpoint remains the flat active-risk overlay feed used by current clients.

Keep the hierarchy stable enough for analytics, but allow operational zones and response grids to evolve as incident data, road access, response-time data, and responder coverage improve.
